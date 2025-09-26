import { FreestyleSandboxes, type DevServer } from 'freestyle-sandboxes';
import {
    Provider,
    ProviderTerminal,
    type InitializeInput,
    type InitializeOutput,
    type CreateProjectInput,
    type CreateProjectOutput,
    type ListFilesInput,
    type ListFilesOutput,
    type ReadFileInput,
    type ReadFileOutput,
    type WriteFileInput,
    type WriteFileOutput,
    type CreateDirectoryInput,
    type CreateDirectoryOutput,
    type DeleteFilesInput,
    type DeleteFilesOutput,
    type CreateTerminalInput,
    type CreateTerminalOutput,
    type TerminalCommandInput,
    type TerminalCommandOutput,
} from '../../types';

export interface FreestyleProviderOptions {
    repoId?: string;
}

export class FreestyleProvider extends Provider {
    private readonly options: FreestyleProviderOptions;
    private devServer: DevServer | null = null;
    private freestyle: FreestyleSandboxes;

    constructor(options: FreestyleProviderOptions) {
        super();
        this.options = options;
        this.freestyle = new FreestyleSandboxes(); // API key should be handled via environment variables
    }

    async initialize(input: InitializeInput): Promise<InitializeOutput> {
        if (!this.options.repoId) {
            return {};
        }

        this.devServer = await this.freestyle.requestDevServer({
            repoId: this.options.repoId,
        });

        return {};
    }

    static async createProject(input: CreateProjectInput): Promise<CreateProjectOutput> {
        const freestyle = new FreestyleSandboxes();
        const repo = await freestyle.createGitRepository({
            name: input.title,
            source: {
                type: 'git',
                url: 'https://github.com/freestyle-sh/freestyle-next', // using a template for now
            },
        });
        return {
            id: repo.repoId,
        };
    }

    async listFiles(input: ListFilesInput): Promise<ListFilesOutput> {
        if (!this.devServer) {
            throw new Error('Dev server not initialized');
        }
        const files = await this.devServer.fs.ls(input.args.path);
        return {
            files: files.map((file) => ({
                path: file.path,
                name: file.path.split('/').pop() || '',
                type: file.type === 'FILE' ? 'file' : 'directory',
            })),
        };
    }

    async readFile(input: ReadFileInput): Promise<ReadFileOutput> {
        if (!this.devServer) {
            throw new Error('Dev server not initialized');
        }
        const content = await this.devServer.fs.readFile(input.args.path);
        return {
            content,
        };
    }

    async writeFile(input: WriteFileInput): Promise<WriteFileOutput> {
        if (!this.devServer) {
            throw new Error('Dev server not initialized');
        }
        await this.devServer.fs.writeFile(input.args.path, input.args.content);
        return {};
    }

    async createDirectory(input: CreateDirectoryInput): Promise<CreateDirectoryOutput> {
        if (!this.devServer) {
            throw new Error('Dev server not initialized');
        }
        await this.devServer.process.exec(`mkdir -p ${input.args.path}`);
        return {};
    }

    async deleteFiles(input: DeleteFilesInput): Promise<DeleteFilesOutput> {
        if (!this.devServer) {
            throw new Error('Dev server not initialized');
        }
        await this.devServer.process.exec(`rm -rf ${input.args.path}`);
        return {};
    }

    async createTerminal(input: CreateTerminalInput): Promise<CreateTerminalOutput> {
        if (!this.devServer) {
            throw new Error('Dev server not initialized');
        }
        return {
            terminal: new FreestyleTerminal(this.devServer),
        };
    }

    async runCommand(input: TerminalCommandInput): Promise<TerminalCommandOutput> {
        if (!this.devServer) {
            throw new Error('Dev server not initialized');
        }
        const { stdout } = await this.devServer.process.exec(input.args.command);
        return {
            output: stdout,
        };
    }

    async destroy(): Promise<void> {
        if (this.devServer) {
            await this.devServer.shutdown();
            this.devServer = null;
        }
    }
}

class FreestyleTerminal extends ProviderTerminal {
    constructor(private readonly devServer: DevServer) {
        super();
    }

    async run(command: string): Promise<void> {
        // This is a simplified implementation. A true interactive terminal would require more.
        await this.devServer.process.exec(command);
    }
    
    // TODO: Implement other terminal methods if possible
    open(): Promise<string> {
        throw new Error('Method not implemented.');
    }
    write(input: string): Promise<void> {
        throw new Error('Method not implemented.');
    }
    kill(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    onOutput(callback: (data: string) => void): () => void {
        throw new Error('Method not implemented.');
    }
    get id(): string {
        return 'freestyle-terminal';
    }
    get name(): string {
        return 'Freestyle Terminal';
    }
}
