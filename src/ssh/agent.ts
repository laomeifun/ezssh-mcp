import { existsSync } from "fs";
import { platform } from "os";

/**
 * Get SSH Agent socket path
 * Supports: Linux, macOS, Windows (OpenSSH, 1Password)
 */
export function getSSHAgentSocket(): string | undefined {
  // 1. Environment variable (works on all platforms)
  if (process.env.SSH_AUTH_SOCK) {
    return process.env.SSH_AUTH_SOCK;
  }

  // 2. Windows-specific named pipes
  if (platform() === "win32") {
    // 1Password SSH Agent
    const onePasswordPipe = "\\\\.\\pipe\\openssh-ssh-agent";
    // Windows OpenSSH Agent
    const openSSHPipe = "\\\\.\\pipe\\openssh-ssh-agent";

    // Check 1Password first (common for developers)
    if (process.env.OP_SSH_AUTH_SOCK) {
      return process.env.OP_SSH_AUTH_SOCK;
    }

    // Return OpenSSH pipe (it's the standard on Windows)
    return openSSHPipe;
  }

  // 3. macOS - check common locations
  if (platform() === "darwin") {
    // 1Password on macOS
    const onePasswordSocket = `${process.env.HOME}/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock`;
    if (existsSync(onePasswordSocket)) {
      return onePasswordSocket;
    }
  }

  // 4. Linux - check common locations
  if (platform() === "linux") {
    // 1Password on Linux
    const onePasswordSocket = `${process.env.HOME}/.1password/agent.sock`;
    if (existsSync(onePasswordSocket)) {
      return onePasswordSocket;
    }
  }

  return undefined;
}

/**
 * Check if SSH Agent is available
 */
export function isAgentAvailable(): boolean {
  const socket = getSSHAgentSocket();
  if (!socket) return false;

  // On Windows, we can't easily check if the pipe exists
  if (platform() === "win32") {
    return true; // Assume it's available
  }

  return existsSync(socket);
}
