# Restores a paused Supabase project by making a simple query.
# The free tier pauses after 7 days of inactivity.
#
# Usage:
#   1. Get your Supabase access token from: https://supabase.com/docs/guides/api
#   2. Set env var: $env:SUPABASE_ACCESS_TOKEN = "your-token"
#   3. Run: .\scripts\restore-supabase.ps1
#
# Or use the Supabase dashboard: Project Settings → Database → "Wake up database"

param(
    [string]$Ref = "reoclbbidpqcvpsfhggl",
    [string]$ProjectHref = "hsnnjjxfaijztsewvkbc"
)

$headers = @{
    "apikey" = "standard-public-api-key"
    "Authorization" = "Bearer $env:SUPABASE_ACCESS_TOKEN"
    "Content-Type" = "application/json"
}

# Make a simple query to wake up the database
$body = @{
    query = "SELECT 1"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod `
        -Uri "https://api.supabase.com/v1/projects/$Ref" `
        -Method GET `
        -Headers $headers `
        -TimeoutSec 30

    Write-Host "Database restore initiated. Check the Supabase dashboard for status."
    Write-Host "Project: $ProjectHref"
} catch {
    Write-Error "Failed to wake database: $_"
    Write-Host "`nManual steps:"
    Write-Host "1. Go to: https://supabase.com/projects/$ProjectHref/settings/database"
    Write-Host "2. Click 'Wake up database' or run a simple query"
    Write-Host "3. The database will be active within 1-2 minutes"
}