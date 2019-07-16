import path from 'path'
import fastify from 'fastify'

import {preloadAllLazyComponents} from '../core/lazy'
import {render} from './render'

export interface ListenResult {
  port: number
  address: string
}

export interface ModuleBundleMap {
  [path: string]: string
}

export interface ServerOptions {
  port?: number
  address?: string

  staticDirPath?: string
  staticHost?: string

  clientEntryFile: string
  moduleBundleMap?: ModuleBundleMap
}

export class Server {
  private readonly port: number
  private readonly address: string

  private readonly staticDirPath?: string
  private readonly staticHost?: string
  private readonly clientEntryFile: string

  private readonly moduleBundleMap?: ModuleBundleMap

  constructor(opts: ServerOptions) {
    this.port = opts.port || 3000
    this.address = opts.address || 'localhost'

    if (opts.staticDirPath && !path.isAbsolute(opts.staticDirPath))
      throw new Error('"staticDirPath" should be an absolute path.')

    this.moduleBundleMap = opts.moduleBundleMap
    this.staticDirPath = opts.staticDirPath
    this.staticHost = opts.staticHost || '/static'
    this.clientEntryFile = opts.clientEntryFile
  }

  async listen(): Promise<ListenResult> {
    const server = fastify()

    await preloadAllLazyComponents()

    const moduleMap = this.moduleBundleMap || {}

    server.get('/', async (_req, reply) => {
      reply.type('text/html')

      const [componentString, renderedPaths] = await render()
      const bundles: string[] = renderedPaths.map(path => moduleMap[path])
      const bundleSet = Array.from(
        new Set(bundles.reduce((acc, file) => [...acc, file], [] as string[]))
      ).filter(url => url !== this.clientEntryFile)

      return `
        <html>
          <head>
            ${bundleSet
              .map(url => `<script async src="${this.staticHost}/${url}"></script>`)
              .join('\n')}
            <script async src="${this.staticHost}/${this.clientEntryFile}"></script>
            <script id="renderedKeys" type="application/json">${JSON.stringify(
              renderedPaths
            )}</script>
          </head>
          <body><div id="reactRoot">${componentString}</div></body>
        </html>
      `
    })

    await server.listen(this.port, this.address)

    return {
      port: this.port,
      address: this.address
    }
  }
}

export async function startServer(opts: ServerOptions): Promise<ListenResult> {
  return new Server(opts).listen()
}