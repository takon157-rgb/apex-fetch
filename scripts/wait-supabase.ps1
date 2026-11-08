$ErrorActionPreference = 'Stop'
$sigPath = Join-Path $PSScriptRoot 'read-supabase-token.ps1'
# reuse the credential reader from the other script
$sig = @'
using System;
using System.Runtime.InteropServices;
public class CredMan2 {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
        public UInt32 Flags; public UInt32 Type; public IntPtr TargetName; public IntPtr Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public UInt32 CredentialBlobSize; public IntPtr CredentialBlob; public UInt32 Persist;
        public UInt32 AttributeCount; public IntPtr Attributes; public IntPtr TargetAlias; public IntPtr UserName;
    }
    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredRead(string target, int type, int flags, out IntPtr credentialPtr);
    [DllImport("advapi32.dll", EntryPoint = "CredFree", SetLastError = true)]
    public static extern void CredFree(IntPtr cred);
}
'@
if (-not ('CredMan2' -as [type])) { Add-Type -TypeDefinition $sig }

$ptr = [IntPtr]::Zero
[CredMan2]::CredRead('Supabase CLI:supabase', 1, 0, [ref]$ptr) | Out-Null
$cred = [Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][CredMan2+CREDENTIAL])
$raw = [byte[]]::new($cred.CredentialBlobSize)
[Runtime.InteropServices.Marshal]::Copy($cred.CredentialBlob, $raw, 0, $cred.CredentialBlobSize)
[CredMan2]::CredFree($ptr)
$token = ([System.Text.Encoding]::UTF8.GetString($raw)).Trim()

$headers = @{ Authorization = "Bearer $token" }
$ref = 'reoclbbidpqcvpsfhggl'

for ($i = 1; $i -le 12; $i++) {
    $p = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/$ref" -Headers $headers -Method Get
    Write-Output "[$i] status: $($p.status)"
    if ($p.status -eq 'ACTIVE') { Write-Output 'PROJECT ACTIVE'; exit 0 }
    Start-Sleep -Seconds 10
}
Write-Output 'STILL NOT ACTIVE'
exit 1
