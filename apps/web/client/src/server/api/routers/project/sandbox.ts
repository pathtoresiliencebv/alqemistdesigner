import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
    CodeProvider,
    createCodeProviderClient,
    getStaticCodeProvider,
} from '@onlook/code-provider';
import { getSandboxPreviewUrl } from '@onlook/constants';

import { createTRPCRouter, protectedProcedure } from '../../trpc';

function getProvider({
    repoId,
    provider = CodeProvider.Freestyle,
}: {
    repoId: string;
    provider?: CodeProvider;
}) {
    if (provider === CodeProvider.Freestyle) {
        return createCodeProviderClient(CodeProvider.Freestyle, {
            providerOptions: {
                freestyle: {
                    repoId,
                },
            },
        });
    }
    // Keeping NodeFs as a fallback or for local dev
    if (provider === CodeProvider.NodeFs) {
        return createCodeProviderClient(CodeProvider.NodeFs, {
            providerOptions: {
                nodefs: {},
            },
        });
    }
    throw new Error(`Unsupported provider: ${provider}`);
}

export const sandboxRouter = createTRPCRouter({
    create: protectedProcedure
        .input(
            z.object({
                title: z.string().optional(),
            }),
        )
        .mutation(async ({ input, ctx }) => {
            // Create a new sandbox using the static provider
            const FreestyleProvider = await getStaticCodeProvider(CodeProvider.Freestyle);

            const newSandbox = await FreestyleProvider.createProject({
                title: input.title || 'Onlook Test Sandbox',
                // other options can be added here based on Freestyle's capabilities
            });

            // TODO: Figure out how to get the preview URL from Freestyle
            // For now, returning a placeholder
            return {
                sandboxId: newSandbox.id,
                previewUrl: `https://freestyle.sh/repo/${newSandbox.id}`, // Placeholder
            };
        }),
});
