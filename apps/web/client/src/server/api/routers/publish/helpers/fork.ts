import { CodeProvider, createCodeProviderClient, getStaticCodeProvider, type Provider } from '@onlook/code-provider';

export async function forkBuildSandbox(
    sandboxId: string, // This is now a repoId for Freestyle
    userId: string,
    deploymentId: string,
): Promise<{ provider: Provider; sandboxId: string }> {
    const FreestyleProvider = await getStaticCodeProvider(CodeProvider.Freestyle);
    
    // In Freestyle, "forking" might mean creating a new branch or a new repo from a template.
    // For now, we'll create a new project (repo) based on a template.
    // This assumes the original `sandboxId` can be used as a template or source.
    const project = await FreestyleProvider.createProject({
        title: 'Deployment Fork of ' + sandboxId,
        // Assuming createProject can take a source repoId
        // This might need adjustment based on actual Freestyle SDK capabilities
    });

    const forkedProvider = await createCodeProviderClient(CodeProvider.Freestyle, {
        providerOptions: {
            freestyle: {
                repoId: project.id,
            },
        },
    });

    return {
        provider: forkedProvider,
        sandboxId: project.id,
    };
}
