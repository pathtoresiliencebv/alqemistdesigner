import { api } from '@/trpc/client';
import { CodeProvider, createCodeProviderClient, type Provider } from '@onlook/code-provider';
import type { Branch } from '@onlook/models';
import { makeAutoObservable } from 'mobx';
import type { ErrorManager } from '../error';
import { CLISessionImpl, CLISessionType, type CLISession, type TerminalSession } from './terminal';

export class SessionManager {
    provider: Provider | null = null;
    isConnecting = false;
    terminalSessions = new Map<string, CLISession>();
    activeTerminalSessionId = 'cli';

    constructor(
        private readonly branch: Branch,
        private readonly errorManager: ErrorManager
    ) {
        this.start(this.branch.sandbox.id);
        makeAutoObservable(this);
    }

    async start(repoId: string, userId?: string) {
        if (this.isConnecting || this.provider) {
            return;
        }
        this.isConnecting = true;

        try {
            this.provider = await createCodeProviderClient(CodeProvider.Freestyle, {
                providerOptions: {
                    freestyle: {
                        repoId,
                    },
                },
            });
            await this.createTerminalSessions(this.provider);
        } catch (error) {
            console.error('Failed to start sandbox session:', error);
            this.provider = null;
            throw error;
        } finally {
            this.isConnecting = false;
        }
    }

    async restartDevServer(): Promise<boolean> {
        if (!this.provider) {
            console.error('No provider found in restartDevServer');
            return false;
        }
        // Freestyle dev servers auto-restart, but we can try running the dev command again.
        // This logic might need to be adapted based on how Freestyle handles dev servers.
        try {
            await this.provider.runCommand({ args: { command: 'npm run dev' }});
            return true;
        } catch (error) {
            console.error('Failed to restart dev server', error);
            return false;
        }
    }

    async readDevServerLogs(): Promise<string> {
        // This is tricky with Freestyle as there's no direct "task" concept like in CodeSandbox.
        // We can try to read the output of the dev command, but that might not be reliable.
        // Returning a placeholder for now.
        return 'Dev server log reading is not fully supported with Freestyle yet.';
    }

    getTerminalSession(id: string) {
        return this.terminalSessions.get(id) as TerminalSession | undefined;
    }

    async createTerminalSessions(provider: Provider) {
        const task = new CLISessionImpl(
            'server',
            CLISessionType.TASK,
            provider,
            this.errorManager,
        );
        this.terminalSessions.set(task.id, task);
        const terminal = new CLISessionImpl(
            'terminal',
            CLISessionType.TERMINAL,
            provider,
            this.errorManager,
        );

        this.terminalSessions.set(terminal.id, terminal);
        this.activeTerminalSessionId = task.id;

        // Initialize the sessions after creation
        try {
            await Promise.all([
                task.initTask(),
                terminal.initTerminal()
            ]);
        } catch (error) {
            console.error('Failed to initialize terminal sessions:', error);
        }
    }

    async disposeTerminal(id: string) {
        const terminal = this.terminalSessions.get(id) as TerminalSession | undefined;
        if (terminal) {
            if (terminal.type === CLISessionType.TERMINAL) {
                await terminal.terminal?.kill();
                if (terminal.xterm) {
                    terminal.xterm.dispose();
                }
            }
            this.terminalSessions.delete(id);
        }
    }

    async hibernate(sandboxId: string) {
        // Freestyle VMs shutdown automatically, so an explicit hibernate might not be needed.
        // The `destroy` method on the provider already handles shutdown.
        console.log('Hibernate called, but Freestyle manages this automatically.');
    }

    async reconnect(repoId: string, userId?: string) {
        try {
            if (!this.provider) {
                console.error('No provider found in reconnect');
                return;
            }

            // Check if the session is still connected
            const isConnected = await this.ping();
            if (isConnected) {
                return;
            }

            // With Freestyle, reconnecting is essentially the same as starting a new session
            await this.start(repoId, userId);
        } catch (error) {
            console.error('Failed to reconnect to sandbox', error);
            this.isConnecting = false;
        }
    }

    async ping() {
        if (!this.provider) return false;
        try {
            await this.provider.runCommand({ args: { command: 'echo "ping"' } });
            return true;
        } catch (error) {
            console.error('Failed to connect to sandbox', error);
            return false;
        }
    }

    async runCommand(
        command: string,
        streamCallback?: (output: string) => void,
        ignoreError: boolean = false,
    ): Promise<{
        output: string;
        success: boolean;
        error: string | null;
    }> {
        try {
            if (!this.provider) {
                throw new Error('No provider found in runCommand');
            }
            
            // Append error suppression if ignoreError is true
            const finalCommand = ignoreError ? `${command} 2>/dev/null || true` : command;
            
            streamCallback?.(finalCommand + '\n');
            const { output } = await this.provider.runCommand({ args: { command: finalCommand } });
            streamCallback?.(output);
            return {
                output,
                success: true,
                error: null,
            };
        } catch (error) {
            console.error('Error running command:', error);
            return {
                output: '',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            };
        }
    }

    async clear() {
        // probably need to be moved in `Provider.destroy()`
        this.terminalSessions.forEach((terminal) => {
            if (terminal.type === CLISessionType.TERMINAL) {
                terminal.terminal?.kill();
                if (terminal.xterm) {
                    terminal.xterm.dispose();
                }
            }
        });
        if (this.provider) {
            await this.provider.destroy();
        }
        this.provider = null;
        this.isConnecting = false;
        this.terminalSessions.clear();
    }
}
