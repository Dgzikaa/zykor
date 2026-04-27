param([string]$path)
$data = Get-Content $path -Raw | ConvertFrom-Json
# Snapshot pode ser: (a) array de lints direto, (b) objeto com .lints, (c) wrapper {result:{lints:[...]}}
$lints = if ($data -is [System.Array] -or $data.GetType().Name -eq 'Object[]') {
  if ($data.Count -gt 0 -and $data[0].PSObject.Properties.Name -contains 'name' -and $data[0].PSObject.Properties.Name -contains 'level') { $data }
  else { $null }
} elseif ($data.PSObject.Properties.Name -contains 'lints') { $data.lints }
elseif ($data.PSObject.Properties.Name -contains 'result') { $data.result.lints }
else { $null }

if (-not $lints) { Write-Output "Could not parse $path"; return }
$total = $lints.Count
Write-Output "TOTAL: $total"
$lints | Group-Object name | Sort-Object Count -Descending | ForEach-Object {
  '{0,-40} {1,4}  ({2})' -f $_.Name, $_.Count, $_.Group[0].level
}
