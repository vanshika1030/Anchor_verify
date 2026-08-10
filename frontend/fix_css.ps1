$filePath = "C:\Users\vansh\.gemini\antigravity\scratch\anchor\frontend\src\index.css"
$bytes = [System.IO.File]::ReadAllBytes($filePath)

# Find first null byte
$nullIndex = -1
for ($i = 0; $i -lt $bytes.Length; $i++) {
    if ($bytes[$i] -eq 0) {
        $nullIndex = $i
        break
    }
}

if ($nullIndex -gt 0) {
    Write-Host "Found null byte at position $nullIndex"
    $cleanBytes = $bytes[0..($nullIndex - 1)]
    [System.IO.File]::WriteAllBytes($filePath, $cleanBytes)
    Write-Host "Truncated file to $($cleanBytes.Length) bytes"
} else {
    Write-Host "No null bytes found"
}
