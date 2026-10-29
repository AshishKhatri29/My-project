import { createServer } from 'node:http'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { defaultProducts } from './src/catalog.js'

const projectRoot = dirname(fileURLToPath(import.meta.url))
const dataFile = resolve(projectRoot, 'data', 'catalog.json')
const distDirectory = resolve(projectRoot, 'dist')
const production = process.env.NODE_ENV === 'production'
const host = process.env.HOST || '127.0.0.1'
const port = Number(process.env.PORT || 8080)
const allowedCategories = new Set(['Fruits & Veggies', 'Dairy & Eggs', 'Bakery', 'Snacks', 'Drinks'])
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
])

function loadEnvironmentFile() {
  const envPath = resolve(projectRoot, '.env')
  return readFile(envPath, 'utf8').then((contents) => {
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
      if (!match || Object.hasOwn(process.env, match[1])) continue
      let value = match[2]
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      } else {
        value = value.replace(/\s+#.*$/, '')
      }
      process.env[match[1]] = value
    }
  }).catch((error) => {
    if (error.code !== 'ENOENT') throw error
  })
}

function writeJson(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  })
  response.end(JSON.stringify(payload))
}

function readRequestBody(request, limit = 1024 * 1024) {
  return new Promise((resolveBody, reject) => {
    let body = ''
    let tooLarge = false
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      if (tooLarge) return
      body += chunk
      if (Buffer.byteLength(body, 'utf8') > limit) {
        tooLarge = true
        reject(Object.assign(new Error('Request body is too large.'), { statusCode: 413 }))
      }
    })
    request.on('end', () => {
      if (tooLarge) return
      try {
        resolveBody(JSON.parse(body || '{}'))
      } catch {
        reject(Object.assign(new Error('Request body must be valid JSON.'), { statusCode: 400 }))
      }
    })
    request.on('error', reject)
  })
}

function validateCatalog(value) {
  if (!Array.isArray(value) || value.length > 500) return 'Catalog must contain between 0 and 500 products.'
  const ids = new Set()
  for (const product of value) {
    if (!product || typeof product !== 'object' || Array.isArray(product)) return 'Each product must be an object.'
    const { id, name, detail, category, image, badge, price, oldPrice } = product
    if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(id) || ids.has(id)) return 'Product IDs must be unique lowercase letters, numbers, and hyphens.'
    ids.add(id)
    if (typeof name !== 'string' || !name.trim() || name.length > 70) return `Product ${id} needs a name no longer than 70 characters.`
    if (typeof detail !== 'string' || !detail.trim() || detail.length > 70) return `Product ${id} needs pack details no longer than 70 characters.`
    if (!allowedCategories.has(category)) return `Product ${id} has an invalid category.`
    if (typeof image !== 'string' || !( /^photo-[A-Za-z0-9-]{3,100}$/.test(image) || isAllowedImageUrl(image) )) return `Product ${id} needs an Unsplash photo ID or images.unsplash.com URL.`
    if (badge !== null && (typeof badge !== 'string' || badge.length > 24)) return `Product ${id} has an invalid badge.`
    if (!Number.isFinite(price) || price <= 0 || price > 10000000) return `Product ${id} needs a valid positive price.`
    if (oldPrice !== null && oldPrice !== undefined && (!Number.isFinite(oldPrice) || oldPrice <= 0 || oldPrice > 10000000)) return `Product ${id} has an invalid old price.`
  }
  return ''
}

function isAllowedImageUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'images.unsplash.com' && !url.username && !url.password
  } catch {
    return false
  }
}

async function readCatalog() {
  try {
    const content = await readFile(dataFile, 'utf8')
    const catalog = JSON.parse(content)
    const validationError = validateCatalog(catalog)
    if (validationError) throw new Error(`Stored catalog is invalid: ${validationError}`)
    return catalog
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    await mkdir(dirname(dataFile), { recursive: true })
    await writeFile(dataFile, `${JSON.stringify(defaultProducts, null, 2)}\n`, { flag: 'wx' }).catch((writeError) => {
      if (writeError.code !== 'EEXIST') throw writeError
    })
    return readCatalog()
  }
}

async function saveCatalog(catalog) {
  const temporaryFile = `${dataFile}.tmp`
  await mkdir(dirname(dataFile), { recursive: true })
  await writeFile(temporaryFile, `${JSON.stringify(catalog, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  await rename(temporaryFile, dataFile)
}

function respondForError(response, error) {
  if (response.headersSent || response.destroyed) return
  const statusCode = error.statusCode || 500
  if (statusCode >= 500) console.error('Request failed:', error)
  writeJson(response, statusCode, { error: statusCode >= 500 ? 'The server could not complete the request.' : error.message })
}

async function getAdminUser(request) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey
    || /your-project-ref|placeholder|example|replace-with|<.*>/i.test(supabaseUrl)
    || /your-|placeholder|example|replace-with|<.*>/i.test(supabaseAnonKey)) {
    return { error: 'Supabase is not configured on the server.', statusCode: 503 }
  }

  const authorization = request.headers.authorization || ''
  const tokenMatch = authorization.match(/^Bearer\s+(\S+)$/i)
  if (!tokenMatch) return { error: 'A Supabase access token is required.', statusCode: 401 }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${tokenMatch[1]}` } },
  })
  const { data: { user }, error: authError } = await client.auth.getUser(tokenMatch[1])
  if (authError || !user) return { error: 'A valid Supabase session is required.', statusCode: 401 }
  if (!user.email_confirmed_at) return { error: 'Email verification is required.', statusCode: 403 }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError) {
    console.error('Unable to read the authenticated user profile:', profileError)
    return { error: 'Admin authorization is not available. Apply the Supabase profile migration first.', statusCode: 503 }
  }
  if (profile?.role !== 'admin') return { error: 'The admin role is required.', statusCode: 403 }
  return { user }
}

async function handleApi(request, response, url) {
  if (url.pathname === '/api/catalog' && request.method === 'GET') {
    writeJson(response, 200, { products: await readCatalog() })
    return
  }

  if (url.pathname === '/api/admin/session' && request.method === 'GET') {
    const authorization = await getAdminUser(request)
    if (authorization.error) {
      writeJson(response, authorization.statusCode, { error: authorization.error })
      return
    }
    writeJson(response, 200, { authenticated: true, userId: authorization.user.id })
    return
  }

  if (url.pathname === '/api/catalog' && request.method === 'PUT') {
    const authorization = await getAdminUser(request)
    if (authorization.error) {
      writeJson(response, authorization.statusCode, { error: authorization.error })
      return
    }
    const body = await readRequestBody(request)
    const validationError = validateCatalog(body.products)
    if (validationError) {
      writeJson(response, 400, { error: validationError })
      return
    }
    await saveCatalog(body.products)
    writeJson(response, 200, { products: body.products })
    return
  }

  writeJson(response, 404, { error: 'API endpoint not found.' })
}

async function serveProductionFile(request, response, url) {
  let requestedPath = decodeURIComponent(url.pathname)
  if (requestedPath === '/') requestedPath = '/index.html'
  const filePath = resolve(distDirectory, `.${requestedPath}`)
  if (!filePath.startsWith(`${distDirectory}${sep}`) && filePath !== resolve(distDirectory, 'index.html')) {
    writeJson(response, 400, { error: 'Invalid path.' })
    return
  }
  try {
    const content = await readFile(filePath)
    response.writeHead(200, {
      'Cache-Control': requestedPath === '/index.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      'Content-Type': mimeTypes.get(extname(filePath)) || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    })
    response.end(content)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    if (extname(requestedPath)) {
      response.writeHead(404)
      response.end('Not found')
      return
    }
    const content = await readFile(resolve(distDirectory, 'index.html'))
    response.writeHead(200, { 'Cache-Control': 'no-cache', 'Content-Type': 'text/html; charset=utf-8' })
    response.end(content)
  }
}

await loadEnvironmentFile()

let vite
const server = createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
  if (url.pathname.startsWith('/api/')) {
    handleApi(request, response, url).catch((error) => respondForError(response, error))
    return
  }
  if (production) {
    serveProductionFile(request, response, url).catch((error) => respondForError(response, error))
    return
  }
  vite.middlewares(request, response)
})

if (production) {
  await readFile(resolve(distDirectory, 'index.html'))
} else {
  const { createServer: createViteServer } = await import('vite')
  const { default: react } = await import('@vitejs/plugin-react')
  vite = await createViteServer({
    configFile: false,
    plugins: [react()],
    appType: 'spa',
    server: { middlewareMode: true, hmr: { server } },
  })
}

server.listen(port, host, () => {
  console.log(`Zipzy ${production ? 'server' : 'development server'} running at http://${host}:${port}/`)
  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY
    || /your-project-ref|placeholder|example|replace-with|<.*>/i.test(process.env.VITE_SUPABASE_URL)
    || /your-|placeholder|example|replace-with|<.*>/i.test(process.env.VITE_SUPABASE_ANON_KEY)) {
    console.warn('Supabase authentication and admin authorization are disabled until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured.')
  }
})

async function shutDown() {
  server.close()
  if (vite) await vite.close()
}

process.on('SIGINT', shutDown)
process.on('SIGTERM', shutDown)
