# Spreekt de voice-over in met een Windows-stem, één WAV-bestand per zin, en schrijft de lengtes naar vo.json.
# Gebruik: powershell -File promo/voiceover.ps1 [-Lang en] [-Voice "Microsoft Zira Desktop"]
param([string]$Lang = "en", [string]$Voice = "Microsoft Zira Desktop", [int]$Rate = 0)
Add-Type -AssemblyName System.Speech
$lines = Get-Content (Join-Path $PSScriptRoot "vo-$Lang.txt") -Encoding UTF8 | Where-Object { $_ -match '\S' -and $_ -notmatch '^#' }
$dir = Join-Path $PSScriptRoot "vo\$Lang"; New-Item -ItemType Directory -Force $dir | Out-Null
$out = @()
$i = 0
foreach($l in $lines){
  $parts = $l -split '\|', 2; $at = [double]$parts[0]; $txt = $parts[1].Trim()
  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $s.SelectVoice($Voice); $s.Rate = $Rate
  $f = Join-Path $dir ("{0:D2}.wav" -f $i)
  $fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(44100, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
  $s.SetOutputToWaveFile($f, $fmt); $s.Speak($txt); $s.Dispose()
  $len = ((Get-Item $f).Length - 44) / (44100 * 2)
  $out += [pscustomobject]@{file = ("vo/$Lang/{0:D2}.wav" -f $i); at = $at; dur = [math]::Round($len, 2); text = $txt}
  $i++
}
$out | ConvertTo-Json | Set-Content (Join-Path $PSScriptRoot "vo-$Lang.json") -Encoding UTF8
$out | ForEach-Object { "{0,5}s  {1,4}s  {2}" -f $_.at, $_.dur, $_.text }
