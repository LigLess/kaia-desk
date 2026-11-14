# 지금 재생 중인 곡: 윈도우가 볼륨 팝업에 보여 주는 정보(유튜브 · 유튜브 뮤직 · 스포티파이 · 멜론 등)를 2초마다 읽어요
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8   # 한글 제목이 깨지지 않게
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $null = $task.Wait(3000); if ($task.IsCompleted) { $task.Result } else { $null } }
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]
$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$last = ''; $thumb = ''
while ($true) {
  $o = $null
  try {
    $s = $mgr.GetCurrentSession()
    if ($s) {
      $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
      if ($p -and $p.Title) {
        $key = $p.Title + '|' + $p.Artist
        if ($key -ne $last) {
          $last = $key; $thumb = ''
          if ($p.Thumbnail) {
            $rs = Await ($p.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
            if ($rs) { $st = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($rs); $ms = New-Object System.IO.MemoryStream; $st.CopyTo($ms); if ($ms.Length -lt 600000) { $thumb = [Convert]::ToBase64String($ms.ToArray()) } }
          }
        }
        $on = [string]$s.GetPlaybackInfo().PlaybackStatus -eq 'Playing'
        $o = @{ t = $p.Title; a = $p.Artist; on = $on; th = $thumb; app = $s.SourceAppUserModelId }
      }
    }
  } catch {}
  if ($o) { [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress)) } else { [Console]::Out.WriteLine('null') }
  [Console]::Out.Flush(); Start-Sleep -Milliseconds 2000
}
