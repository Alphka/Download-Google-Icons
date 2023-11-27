// @ts-check

const { default: axios } = require("axios")
const { mkdirSync, createWriteStream, writeFileSync } = require("fs")
const { join } = require("path")
const { URL } = require("url")

new class Index {
	parallelDownloads = 10
	outputFolder = join(__dirname, "output")

	baseURL = new URL("/icons?icon.platform=web", "https://fonts.google.com")
	baseScriptRegex = /(?<=<script id="base-js" src=")[^"]+(?="(?:[\s\w="/-]*>))/
	scriptObjectsRegex = /(?<=var \w+=){[^}]+}(?=;)/g

	/** @type {string} */ baseURLData
	/** @type {string} */ baseScriptData
	/** @type {string} */ baseScriptURL
	/** @type {Record<string, string>} */ namesObject
	/** @type {Record<string, string>} */ downloadURLs
	/** @type {Array<string>} */ errored = []

	constructor(){
		axios.defaults.headers.get = {
			Accept: "text/html,application/xhtml+xml,application/xml",
			"Accept-Encoding": "gzip, deflate, br",
			"Accept-Language": "en-US,en",
			Referer: this.baseURL.origin,
			"Cache-Control": "max-age=0",
			DNT: "1",
			"Upgrade-Insecure-Requests": "1",
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36"
		}

		this.variations = [
			"outlined",
			"rounded",
			"reduced",
			"sharp"
		]

		mkdirSync(this.outputFolder, { recursive: true })

		this.Init()
	}
	async Init(){
		await this.RequestBaseURL()
		this.GetScriptURL()
		await this.RequestBaseScript()
		this.GetScriptObjects()
		this.GetDownloadURLs()
		this.StartDownloading()
	}
	async RequestBaseURL(){
		const response = await axios.get(this.baseURL.href)
		const html = /** @type {string} */ (response.data)

		if(!html) throw new Error("Index response did not return a body")

		return this.baseURLData = html
	}
	GetScriptURL(){
		const match = this.baseURLData.match(this.baseScriptRegex)
		const url = match?.[0]

		if(!url) throw new Error("Script URL not found")

		return this.baseScriptURL = url.replace(/^\/\//, "https://")
	}
	async RequestBaseScript(){
		const response = await axios.get(this.baseScriptURL, {
			headers: {
				Accept: "*\/*"
			}
		})

		return this.baseScriptData = /** @type {string} */ (response.data)
	}
	GetScriptObjects(){
		const match = this.baseScriptData.match(this.scriptObjectsRegex)

		if(!match?.length) throw new Error("No objects were found in the script")

		const namesObject = match.find(object => this.variations.every(e => object.includes(`_${e}`)))

		if(!namesObject) throw new Error("Names object was not found")

		return this.namesObject = JSON.parse(namesObject.replace(/\w+(?=\s*:)/g, '"$&"'))
	}
	/** @param {string} name */
	GetDownloadURL(name){
		return `https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/${name}/default/48px.svg`
	}
	GetDownloadURLs(){
		const keys = new Set(Object.keys(this.namesObject))

		for(const key of keys) if(this.variations.some(e => key.includes(`_${e}`))) keys.delete(key)

		return this.downloadURLs = Object.fromEntries(Array.from(keys).map(name => [name, this.GetDownloadURL(name)]))
	}
	async StartDownloading(){
		const { downloadURLs, parallelDownloads } = this
		const totalURLs = Object.keys(downloadURLs).length
		const queue = /** @type {Map<string, Promise>} */ (new Map)

		for(let index = 0, add = parallelDownloads; index < totalURLs; add = parallelDownloads - queue.size, index += add){
			const entries = Object.entries(downloadURLs).splice(index, add)

			if(add === 0){
				await Promise.race(queue.values())
				continue
			}

			if(!entries.length){
				await Promise.allSettled(queue.values())
				break
			}

			entries.forEach(([name, url]) => {
				const promise = axios.get(url, { responseType: "stream" })
					.then(response => this.DownloadIcon(name, response))
					.catch(error => {
						this.errored.push(name)

						if(error.isAxiosError){
							const status = error.response?.status

							if(status === 404){
								console.error(`Icon not found: ${name}`)
								this.errored.splice(this.errored.indexOf(name), 1)
							}

							return console.error(`Error at request to (${url}), status: ${status}`)
						}

						console.error(error)
					})
					.finally(() => queue.delete(url))

				queue.set(url, promise)
			})

			await Promise.race(queue.values())
		}

		console.log("Trying to download errored files")

		const deleteIndexes = []

		for(const name of this.errored){
			try{
				const url = this.GetDownloadURL(name)
				const response = await axios.get(url, { responseType: "stream" })
				await this.DownloadIcon(name, response)
				deleteIndexes.push(this.errored.indexOf(name))
			}catch(error){
				console.error("Error trying to download file: %s", name)
			}
		}

		for(const index of deleteIndexes.reverse()) this.errored.splice(index, 1)

		console.log("Finished downloading")

		if(this.errored.length) console.log("Total errors: %d", this.errored.length)
	}
	/**
	 * @param {string} name
	 * @param {import("axios").AxiosResponse<import("stream").Writable>} response
	 */
	async DownloadIcon(name, response){
		const basename = `${name}.svg`
		const path = join(this.outputFolder, basename)

		response.data.pipe(createWriteStream(path))
	}
}
