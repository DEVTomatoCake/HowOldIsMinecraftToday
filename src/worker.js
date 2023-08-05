import { getAssetFromKV } from "@cloudflare/kv-asset-handler"
import manifestJSON from "__STATIC_CONTENT_MANIFEST"
const assetManifest = JSON.parse(manifestJSON)

const msTimes = {
	s: 1000,
	m: 1000 * 60,
	h: 1000 * 60 * 60,
	d: 1000 * 60 * 60 * 24,
	w: 1000 * 60 * 60 * 24 * 7,
	mo: 1000 * 60 * 60 * 24 * 30,
	y: 1000 * 60 * 60 * 24 * 365
}
const ms = input => {
	if (input == 0) return "0"

	const output = []
	let rest = input

	const msNames = {
		s: "second[s]",
		m: "minute[s]",
		h: "hour[s]",
		d: "day[s]",
		w: "week[s]",
		mo: "month[s]",
		y: "year[s]"
	}

	for (let i = Object.keys(msTimes).length - 1; i >= 0; i--) {
		const unit = Object.keys(msTimes)[i]
		const time = Math.floor(rest / msTimes[unit])
		if (time > 0) {
			rest -= time * msTimes[unit]
			output.push(time + " " + (time == 1 ? msNames[unit].replace(/\[\w+\]/, "") : msNames[unit].replace(/\[|\]/g, "")))
			if (output.length > 3) break
		}
	}
	if (output.length > 2) output.pop()
	return output.length > 1 ? output.slice(0, -1).join(", ") + (output.length > 1 ? " and " + output.at(-1) : "") : output[0]
}

const discordEmbed = (url, ver) => {
	const date = ver ? new Date(ver.releaseTime) : void 0
	return "<meta property='og:type' name='og:type' content='website'>" +
		"<meta property='og:url' content='" + (new URL(url)).origin + "'>" +
		(ver ?
			"<meta property='og:title' content='Minecraft " + ver.id + "'>" +
			"<meta property='og:description' content='The Minecraft " + ver.type + " " + ver.id + " was published on " + date.getFullYear() + "-" +
			(date.getMonth() + 1 < 10 ? "0" : "") + (date.getMonth() + 1) + "-" + (date.getDate() + 1 < 10 ? "0" : "") + date.getDate() +
			" at " + date.toLocaleTimeString("UTC", {timeStyle: "long", hourCycle: "h24"}) + ". That was " + ms(Date.now() - date.getTime()) + " ago!'>" +
			"<meta name='theme-color' content='#17C40E'>"
		:
			"<meta property='og:title' content='Unknown version!'>" +
			"<meta property='og:description' content='Find out when Minecraft versions were published and a bit more :D'>" +
			"<meta name='theme-color' content='#FF0000'>"
		)
}

export default {
	async fetch(request, env, ctx) {
		let path = decodeURI((new URL(request.url)).pathname)
		if (path == "/" || path == "/favicon.ico") {
			return await getAssetFromKV(
				{
					request,
					waitUntil: ctx.waitUntil.bind(ctx)
				},{
					ASSET_NAMESPACE: env.__STATIC_CONTENT,
					ASSET_MANIFEST: assetManifest
				}
			)
		}
		if (!request.headers.get("User-Agent").includes("Discord")) return Response.redirect((new URL(request.url)).origin)

		const versions = await env.MC_VERSION_CACHE.get("versions")

		let json = {}
		if (versions) json = JSON.parse(versions)
		else {
			const res = await fetch("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json")
			if (!res.ok) return new Response("Cannot reach mojang versions api")

			json = (await res.json()).versions
			await env.MC_VERSION_CACHE.put("versions", JSON.stringify(json), {
				expirationTtl: 60 * 60 * 2
			})
		}

		const ver = json.find(v => v.id == path.split("/")[1])
		return new Response(discordEmbed(request.url, ver), {
			headers: { "Content-Type": "text/html" }
		})
	}
}
