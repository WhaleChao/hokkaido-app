/** 把說明文字裡的 http(s) 網址變成可點的連結（其他協定一律不轉）。 */
export function Linkify({ text }: { text: string }) {
    const parts = text.split(/(https?:\/\/[^\s）)]+)/g);
    return (
        <>
            {parts.map((part, i) =>
                /^https?:\/\//.test(part) ? (
                    <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-all' }}>
                        {part.length > 40 ? part.substring(0, 40) + '…' : part}
                    </a>
                ) : (
                    part
                ),
            )}
        </>
    );
}

