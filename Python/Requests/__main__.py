from urllib.parse import urlparse
import requests
import path
import os
import re

outputFolder = os.path.dirname(__file__)
baseURL = urlparse("https://fonts.google.com/icons?icon.platform=web")
baseScriptRegex = r"(?<=<script id=\"base-js\" src=\")[^\"]+(?=\"(?:[\s\w=\"/-]*>))"
scriptObjectsRegex = r"(?<=var )(?:[\w ]+=)({[^}]+}(?=;))"

errored = []

headers = {
	"Accept": "text/html,application/xhtml+xml,application/xml",
	"Accept-Encoding": "gzip, deflate, br",
	"Accept-Language": "en-US,en",
	"Referer": f"{baseURL.scheme}://{baseURL.hostname}/",
	"Cache-Control": "max-age=0",
	"DNT": "1",
	"Upgrade-Insecure-Requests": "1",
	"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36"
}

variations = [
	"outlined",
	"rounded",
	"reduced",
	"sharp"
]

try:
	os.mkdir(outputFolder)
except:
	print("Folder was already created.")
