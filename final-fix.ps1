# Final fix for duplicate className attributes
$appFile = "src\renderer\App.tsx"
$content = Get-Content $appFile -Raw -Encoding UTF8

Write-Host "Final fixes..." -ForegroundColor Green

# Fix window controls - merge className
$content = $content -replace 'className="btn ghost"([^>]*?) onClick=\(\(\) => window\.api\?\.window\?\.minimize\?\.\(\)\) className="icon-btn"', 'className="btn ghost icon-btn"$1 onClick={() => window.api?.window?.minimize?.()}'
$content = $content -replace 'className="btn ghost"([^>]*?) onClick=\(\(\) => window\.api\?\.window\?\.toggleMaximize\?\.\(\)\) className="icon-btn"', 'className="btn ghost icon-btn"$1 onClick={() => window.api?.window?.toggleMaximize?.()}'
$content = $content -replace 'className="btn danger"([^>]*?) onClick=\(\(\) => window\.api\?\.window\?\.close\?\.\(\)\) className="icon-btn"', 'className="btn danger icon-btn"$1 onClick={() => window.api?.window?.close?.()}'

# Fix pagination buttons - remove duplicate className
$content = $content -replace '(<button className="btn"[^>]*?) className=\{duePage <= 1 \? "opacity-60 cursor-not-allowed" : ""\}', '$1'
$content = $content -replace '(<button className="btn"[^>]*?) className=\{duePage >= Math\.max\(1, Math\.ceil\(due\.length / pageSize\)\) \? "opacity-60 cursor-not-allowed" : ""\}', '$1'

# Fix icon-btn in line 698
$content = $content -replace '(\s+className="btn ghost"\s+aria-label="Seitenleiste umschalten"[^>]*?\n\s+onClick=\{[^}]+\}\n\s+)className="icon-btn"', '$1'

Write-Host "Fixed!" -ForegroundColor Green

Set-Content $appFile -Value $content -NoNewline -Encoding UTF8
