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

Add-Type -TypeDefinition $sig

$target = 'Supabase CLI:supabase'
$ptr = [IntPtr]::Zero

if ([CredMan]::CredRead($target, 1, 0, [ref]$ptr)) {
    $cred = [Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][CredMan+CREDENTIAL])
    $bytes = [Runtime.InteropServices.Marshal]::PtrToStringUni($cred.CredentialBlob, $cred.CredentialBlobSize / 2)
    [CredMan]::CredFree($ptr)
    if ($bytes) {
        $bytes.Trim() | Write-Output
    } else {
        Write-Error 'Credential blob empty'
    }
} else {
    $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    Write-Error "CredRead failed (win32=$err)"
}
