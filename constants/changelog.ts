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
