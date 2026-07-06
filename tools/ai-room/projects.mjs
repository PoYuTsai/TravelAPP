const PROJECT_DEFINITIONS = {
  travel: {
    key: 'travel',
    project: 'TravelAPP',
    workspace: 'C:/Users/eric1/OneDrive/Desktop/TravelAPP',
    activeSession: 'rc-travel',
    legacySession: 'dc-travel',
    sessions: {
      'rc-travel': {
        owner: 'private-room',
        plane: 'rc',
        privateRoomAccess: 'write',
      },
      'dc-travel': {
        owner: 'legacy-dc',
        plane: 'dc',
        privateRoomAccess: 'read',
        warning:
          'dc-travel is reserved for legacy/project-channel monitoring; private room writes require explicit unlock.',
      },
    },
  },
  vibesync: {
    key: 'vibesync',
    project: 'VibeSync',
    workspace: 'C:/Users/eric1/OneDrive/Desktop/VibeSync',
    activeSession: 'rc-vibesync',
    legacySession: 'dc-vibesync',
    sessions: {
      'rc-vibesync': {
        owner: 'private-room',
        plane: 'rc',
        privateRoomAccess: 'write',
      },
      'dc-vibesync': {
        owner: 'legacy-dc',
        plane: 'dc',
        privateRoomAccess: 'read',
        warning:
          'dc-vibesync may be monitored or controlled by the legacy partner project channel; private room writes require explicit unlock.',
      },
    },
  },
}

export const PROJECTS = Object.freeze(PROJECT_DEFINITIONS)

export function listProjectKeys() {
  return Object.keys(PROJECTS)
}

export function getProjectConfig(focus) {
  const project = PROJECTS[focus]
  if (!project) {
    throw new Error(
      `Unknown AI room focus "${focus}". Expected one of: ${listProjectKeys().join(', ')}.`
    )
  }
  return project
}
