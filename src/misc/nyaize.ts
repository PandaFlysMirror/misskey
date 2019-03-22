export function nyaize(text: string): string {
	return text
		// ja-JP
		.replace(/な/g, 'にゃ').replace(/ナ/g, 'ニャ').replace(/ﾅ/g, 'ﾆｬ')
		// ko-KR
		.replace(/[나-낳]/g, (match: string) => String.fromCharCode(
			match.codePointAt(0)  + '냐'.charCodeAt(0) - '나'.charCodeAt(0)
		));
}
