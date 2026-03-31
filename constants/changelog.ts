export interface ChangelogEntry {
  version: string;
  date: string;
  enhancements: string[];
  bugFixes: string[];
}

// This file is auto-updated by scripts/generate-changelog.js on each deployment.
// To add release notes manually, add an entry to the array below.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.1.0',
    date: '2026-03-30',
    enhancements: [
      'Split Slack webhooks: separate channels for user access requests vs approvals',
      'Consolidated admin: SP Members and HC Members now managed in the same screen as User Roles (3 tabs)',
      'Removed separate SP Admin and HC Admin screens — all management in one place',
      '"Manage Members" button in Settings replaces three separate buttons',
    ],
    bugFixes: [],
  },
  {
    version: '2.0.0',
    date: '2026-03-30',
    enhancements: [
      'Complete Spanish translation audit — all 28 hardcoded English strings now use translation system',
      'Release section fully translated (member name, current calling, ward picker, status labels)',
      'Ordination labels (Elder/High Priest) translated',
      'Validation messages, success alerts, and activity log entries translated',
      'Admin screens (Settings, SP Admin, HC Admin, User Roles) error alerts translated',
      'Slack webhook test messages translated',
    ],
    bugFixes: [
      'Fixed "Assign role:" label not translating in pending user management',
      'Fixed "Select Ward (Release)" modal title not translating',
      'Fixed "No ward / not applicable" picker option not translating',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-03-30',
    enhancements: [
      'New User Roles admin screen — view all approved users and change their assigned roles',
      'Revoke access option to remove a user without deleting their account',
      'Accessible from Settings > Leadership for Stake Presidency, Stake Clerk, and Executive Secretary',
    ],
    bugFixes: [],
  },
  {
    version: '1.8.0',
    date: '2026-03-29',
    enhancements: [
      'Member to be Released section now has a "Mark as released" checkmark — tap it to confirm the release is done; it turns green when complete',
    ],
    bugFixes: [
      'Fixed app navigating back to the New Entry tab whenever you switch browser tabs or apps — it now stays on whichever screen you were on',
      'Corrected Spanish sustaining script: "LIBERACIONES" → "RELEVOS", "liberar" → "relevar", fixed in-favor and opposed vote wording, fixed "guion" spelling',
      'Releases in Spanish now read "Los que deseen manifestar su agradecimiento…" instead of asking for a vote',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-03-29',
    enhancements: [
      'Calling picker now filters by type — ward callings show only Bishopric and Elders Quorum options; stake callings show only Stake options',
      'Role is no longer selected on the registration screen — approvers now assign the correct role at approval time to prevent mistakes',
      'Approver can select a role for each pending user directly in Settings before tapping Approve',
    ],
    bugFixes: [
      'Sustaining script no longer asks for an opposing vote on releases — releases now end with "Thank you." per GHB 30.3',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-03-29',
    enhancements: [
      'Sustaining Script is now fully translated to Spanish — all wording, headers, and motions update when language is set to Spanish',
      'Stake Clerk and Executive Secretary can now be added to the Stake Presidency Members admin page (Settings \u2192 Manage Stake Presidency Members)',
      'Assignee filter labels on the HC Board now display in the correct language',
      'Added two new ward callings: Assistant Ward Clerk Finance and Assistant Ward Clerk Membership',
      'Help documentation updated: HC Board section now describes the Sustaining Script; Slack section explains @mention setup',
    ],
    bugFixes: [
      'Fixed sustaining script showing English text regardless of language setting',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-03-29',
    enhancements: [
      'Slack notifications now fire immediately when a user requests access (previously only on approval)',
      'Slack links to cards now navigate directly to the card, even if you need to log in first',
      'Slack notifications now @mention the assigned member when a card advances to their step (e.g. extend calling, sustain, set apart)',
      'HC Admin and SP Admin screens now support setting a Slack User ID per member — tap the @ icon on any member row to configure',
      'Language preference now follows your account across all devices — set it once in Settings and it applies everywhere you log in',
    ],
    bugFixes: [],
  },
  {
    version: '1.4.0',
    date: '2026-03-29',
    enhancements: [
      'Member to be Released section on calling cards — capture name, current calling, and ward from card creation through all stages',
      'Sustaining Script generator on the HC Board — tap the button at the top of the Sustain column, select a ward, and get a GHB 30.3-formatted script ready to read from the pulpit',
      'Sustaining script includes releases first (for any calling with a release member attached), then all sustainings for that ward',
      'Copy-to-clipboard button on the sustaining script for easy transfer to phone or notes',
    ],
    bugFixes: [],
  },
  {
    version: '1.3.0',
    date: '2026-03-29',
    enhancements: [
      'Full Spanish language support — switch between English and Spanish in Settings',
      'Language preference is saved and persists across sessions',
      'All screens, modals, labels, and buttons are fully translated',
      'Kanban columns now scroll when content fills the screen',
    ],
    bugFixes: [],
  },
  {
    version: '1.2.0',
    date: '2026-03-29',
    enhancements: [
      'Idle session timeout: automatic sign-out after 15 minutes of inactivity with a 3-minute warning',
      'Navigation state is now persisted — returning to the app after switching browser tabs restores your last page',
      'Ward sustaining checkboxes for stake callings now gate advancement; SP, Counselors, Clerk, and Exec Secretary can override',
      'Stake Presidency, Stake Clerk, and Executive Secretary can now move callings back one stage',
      'Stake Presidency, Stake Clerk, and Executive Secretary can now delete callings',
      'Disclaimer added to all pages: not an official Church app',
      'Custom icons replaced with improved versions across all views',
      'Access permissions table updated to reflect new Move Back and Delete permissions',
      'Legend on permissions table no longer cuts off text',
      'Icons on cards and tab bar increased in size for better visibility',
    ],
    bugFixes: [
      'Fixed legend text being cut off on the Access Permissions screen',
      'Ward sustaining section now refreshes correctly without a separate fetch cycle',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-03-29',
    enhancements: [
      'Slack messages now include a direct link to the card and show who made the change',
      'Slack notifications sent when a user requests access or is approved',
      'New button moved to leftmost tab for quicker access',
      'Added Help & Documentation screen with role descriptions, workflow stages, and FAQ',
      'Release Notes screen now available in Settings',
      'HC Board filter now shows cards pending your HC approval when filtering by assignee',
      'Added User Access Requests & Approvals Slack webhook setting',
      'Improved home screen icon on Safari iOS (PWA)',
    ],
    bugFixes: [
      'Fixed brief flash of the Pending Approval screen after logging in as an approved user',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-01-01',
    enhancements: [
      'Initial release of Magnify',
      'SP Board with Ideas, For Approval, and Stake Approved columns',
      'HC Board with full calling workflow (HC Approval through Record)',
      'Role-based access for Stake Presidency, High Councilors, Clerk, and Executive Secretary',
      'Slack webhook notifications for SP Board updates, HC Board updates, and rejections',
      'Ward and assignee filters on the HC Board',
      'Calling log with full audit trail',
      'Ward sustaining tracking',
    ],
    bugFixes: [],
  },
];
