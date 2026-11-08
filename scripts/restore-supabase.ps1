$ErrorActionPreference = 'Stop'

$sig = @'
using System;
using System.Runtime.InteropServices;

public class CredMan {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
        public UInt32 Flags;
        public UInt32 Type;
        public IntPtr TargetName;
        public IntPtr Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public UInt32 CredentialBlobSize;
        public IntPtr CredentialBlob;
        public UInt32 Persist;
        public UInt32 AttributeCount;
        public IntPtr Attributes;
        public IntPtr TargetAlias;
        public IntPtr UserName;
    }

    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredRead(string target, int type, int flags, out IntPtr credentialPtr);

    [DllImport("advapi32.dll", EntryPoint = "CredFree", SetLastError = true)]
    public static extern void CredFree(IntPtr cred);
}
'@

if (-not ('CredMan' -as [type])) { Add-Type -TypeDefinition $sig }

function Get-SupabaseToken {
    $ptr = [IntPtr]::Zero
    if (-not [CredMan]::CredRead('Supabase CLI:supabase', 1, 0, [ref]$ptr)) {
        throw "CredRead failed (win32=$([Runtime.InteropServices.Marshal]::GetLastWin32Error()))"
    }
    try {
        $cred = [Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][CredMan+CREDENTIAL])
        $raw = [byte[]]::new($cred.CredentialBlobSize)
        [Runtime.InteropServices.Marshal]::Copy($cred.CredentialBlob, $raw, 0, $cred.CredentialBlobSize)
        # CredentialBlobSize is in bytes; the CLI stores UTF-8.
        return ([System.Text.Encoding]::UTF8.GetString($raw)).Trim()
    } finally {
        [CredMan]::CredFree($ptr)
    }
}

$token = Get-SupabaseToken
Write-Output "token acquired (length $($token.Length))"

$headers = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }
$ref = 'reoclbbidpqcvpsfhggl'

Write-Output '--- project status before ---'
try {
    $p = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/$ref" -Headers $headers -Method Get
    Write-Output "status: $($p.status)"
} catch {
    Write-Output "status lookup failed: $($_.Exception.Message)"
}

Write-Output '--- attempting restore ---'
try {
    $r = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/$ref/restore" -Headers $headers -Method Post
    Write-Output "restore response: $($r | ConvertTo-Json -Compress -Depth 3)"
} catch {
    $resp = $_.Exception.Response
    if ($resp) {
        $code = [int]$resp.StatusCode
        $body = (New-Object System.IO.StreamReader($resp.GetResponseStream())).ReadToEnd()
        Write-Output "restore failed HTTP $code : $body"
    } else {
        Write-Output "restore failed: $($_.Exception.Message)"
    }
}
