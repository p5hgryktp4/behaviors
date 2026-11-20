// Minimal static server for the browser regression fixtures. It serves the repository
// root so fixtures can import the built ESM bundle from /dist/esm/index.mjs.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const port = Number(process.env.PORT ?? 4173)
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
}

http
  .createServer((request, response) => {
    const urlPath = decodeURIComponent((request.url ?? '/').split('?')[0])
    const file = path.join(repositoryRoot, urlPath === '/' ? '/tests/browser/fixtures/harness.html' : urlPath)

    if (!file.startsWith(repositoryRoot + path.sep)) {
      response.writeHead(403)
      response.end('forbidden')
      return
    }

    fs.readFile(file, (error, contents) => {
      if (error) {
        response.writeHead(404)
        response.end('not found')
        return
      }
      response.writeHead(200, {'content-type': mimeTypes[path.extname(file)] ?? 'application/octet-stream'})
      response.end(contents)
    })
  })
  .listen(port, '127.0.0.1', () => {
    console.log(`fixture server listening on http://127.0.0.1:${port}`)
  })
