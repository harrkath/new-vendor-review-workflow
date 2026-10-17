<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Vendor workflow state lives in Lovable Cloud: public tables `vendor_requests` / `request_messages` / `notices` plus the private `contracts` storage bucket, synced client-side in src/lib/vendor-store.ts (realtime + 30s backstop refresh; pure rules stay in src/lib/workflow.ts). Demo has no login — anon RLS policies allow anyone with the URL to read and write; add auth before real use.
- Presentation uses shared semantic tokens in `src/styles.css`, shared page-layout classes and the existing Button component; keep visual changes separate from workflow rules and persistence.
