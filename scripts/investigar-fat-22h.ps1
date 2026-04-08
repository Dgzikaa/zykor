$supabaseUrl = 'https://uqtgsvujwcbymjmvkjhy.supabase.co'
$serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0'
$headers = @{ 'apikey' = $serviceKey; 'Authorization' = 'Bearer $serviceKey' }

Write-Host 'Investigando % fato após 22h - Semana 14/2026 - Deboche' -ForegroundColor Cyan
Write-Host ''

$response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/faturamento_hora?bar_id=eq.4&data_venda=gte.2026-03-30&data_venda=lte.2026-04-05&select=data_venda,hora,valor&order=data_venda,hora" -Headers $headers -Method Get

Write-Host 'Registros com hora = 0:' -ForegroundColor Yellow
$response | Where-Object { $_.hora -eq '0' } | Format-Table -AutoSize

Write-Host ''
Write-Host 'Registros com hora >= 22:' -ForegroundColor Yellow
$response | Where-Object { [int]$_.hora -ge 22 } | Format-Table -AutoSize

Write-Host ''
Write-Host 'Total por hora:' -ForegroundColor Yellow
$response | Group-Object hora | Select-Object Name, Count, @{N='Total';E={($_.Group | Measure-Object -Property valor -Sum).Sum}} | Sort-Object Name | Format-Table -AutoSize
