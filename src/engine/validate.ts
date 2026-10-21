import type { Condition, StoryNode, StoryProject } from './schema';

/**
 * Project validation.
 *
 * The importer, the editor and the runtime all call this before a project is
 * allowed to run, so a broken graph never reaches the player.
 */

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
  nodeId?: string;
  field?: string;
}

const ENGINE_FLAGS = new Set(['answeredCall', 'declinedCall', 'missedCall']);

function targetsOf(node: StoryNode): Array<{ target: string | undefined; label: string }> {
  switch (node.type) {
    case 'start':
      return [{ target: node.nextNodeId, label: 'next' }];
    case 'dialogue':
    case 'message':
    case 'timedEvent':
    case 'socialPost':
    case 'variableUpdate':
      return [{ target: node.nextNodeId, label: 'next' }];
    case 'incomingCall':
    case 'outgoingCall':
      return [
        { target: node.nextNodeId, label: 'next' },
        { target: node.onAnswerNodeId, label: 'answered' },
        { target: node.onDeclineNodeId, label: 'declined' },
        { target: node.onMissedNodeId, label: 'missed' },
      ];
    case 'choice':
      return [
        { target: node.nextNodeId, label: 'next' },
        ...node.options.map((o) => ({ target: o.nextNodeId, label: `option:${o.id}` })),
      ];
    case 'conditional':
      return [
        ...node.branches.map((b) => ({ target: b.nextNodeId, label: `branch:${b.id}` })),
        { target: node.fallbackNodeId, label: 'fallback' },
      ];
    case 'ending':
    case 'failureEnding':
      return [];
  }
}

function collectConditionFlags(condition: Condition | undefined, out: Set<string>): void {
  if (!condition) return;
  switch (condition.kind) {
    case 'flag':
      out.add(condition.flag);
      break;
    case 'all':
    case 'any':
      condition.conditions.forEach((c) => collectConditionFlags(c, out));
      break;
    case 'not':
      collectConditionFlags(condition.condition, out);
      break;
    default:
      break;
  }
}

function collectConditionVariables(condition: Condition | undefined, out: Set<string>): void {
  if (!condition) return;
  switch (condition.kind) {
    case 'var':
      out.add(condition.variableId);
      break;
    case 'all':
    case 'any':
      condition.conditions.forEach((c) => collectConditionVariables(c, out));
      break;
    case 'not':
      collectConditionVariables(condition.condition, out);
      break;
    default:
      break;
  }
}

export function validateProject(project: StoryProject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set(project.nodes.map((n) => n.id));
  const endingIds = new Set(project.endings.map((e) => e.id));
  const characterIds = new Set(project.characters.map((c) => c.id));
  const chatIds = new Set(project.chats.map((c) => c.id));
  const callIds = new Set(project.calls.map((c) => c.id));
  const postIds = new Set(project.socialPosts.map((p) => p.id));
  const contactIds = new Set(project.contacts.map((c) => c.id));
  const variableIds = new Set(project.variables.map((v) => v.id));

  const push = (issue: ValidationIssue) => issues.push(issue);

  /* --------------------------- duplicate ids --------------------------- */
  const seen = new Set<string>();
  for (const node of project.nodes) {
    if (seen.has(node.id)) {
      push({
        severity: 'error',
        code: 'duplicate-node-id',
        message: `ID node "${node.id}" dipakai lebih dari sekali.`,
        nodeId: node.id,
      });
    }
    seen.add(node.id);
  }

  /* ------------------------------ start node ---------------------------- */
  if (!nodeIds.has(project.project.startNodeId)) {
    push({
      severity: 'error',
      code: 'missing-start-node',
      message: `Node awal "${project.project.startNodeId}" tidak ditemukan.`,
      field: 'project.startNodeId',
    });
  }

  /* ------------------------------ references ----------------------------- */
  for (const node of project.nodes) {
    for (const { target, label } of targetsOf(node)) {
      if (target && !nodeIds.has(target)) {
        push({
          severity: 'error',
          code: 'broken-reference',
          message: `Tujuan "${target}" (${label}) tidak ada.`,
          nodeId: node.id,
          field: label,
        });
      }
    }

    if (node.type === 'dialogue') {
      for (const line of node.lines) {
        if (!characterIds.has(line.characterId)) {
          push({
            severity: 'error',
            code: 'missing-character',
            message: `Karakter "${line.characterId}" tidak ditemukan.`,
            nodeId: node.id,
            field: line.id,
          });
        }
      }
      if (!chatIds.has(node.chatId)) {
        push({
          severity: 'error',
          code: 'missing-chat',
          message: `Percakapan "${node.chatId}" tidak ditemukan.`,
          nodeId: node.id,
          field: 'chatId',
        });
      }
    }

    if (node.type === 'message') {
      if (!chatIds.has(node.chatId)) {
        push({
          severity: 'error',
          code: 'missing-chat',
          message: `Percakapan "${node.chatId}" tidak ditemukan.`,
          nodeId: node.id,
          field: 'chatId',
        });
      }
      if (!characterIds.has(node.characterId)) {
        push({
          severity: 'error',
          code: 'missing-character',
          message: `Karakter "${node.characterId}" tidak ditemukan.`,
          nodeId: node.id,
          field: 'characterId',
        });
      }
    }

    if (node.type === 'choice') {
      if (!chatIds.has(node.chatId)) {
        push({
          severity: 'error',
          code: 'missing-chat',
          message: `Percakapan "${node.chatId}" tidak ditemukan.`,
          nodeId: node.id,
          field: 'chatId',
        });
      }
      if (node.options.length === 0) {
        push({
          severity: 'warning',
          code: 'choice-without-options',
          message: 'Node pilihan tidak punya opsi apa pun.',
          nodeId: node.id,
        });
      }
      for (const option of node.options) {
        if (!option.nextNodeId && !option.endingId && !node.nextNodeId) {
          push({
            severity: 'error',
            code: 'option-missing-target',
            message: `Pilihan "${option.text.slice(0, 40)}" tidak punya tujuan node maupun ending.`,
            nodeId: node.id,
            field: option.id,
          });
        }
        if (option.endingId && !endingIds.has(option.endingId)) {
          push({
            severity: 'error',
            code: 'missing-ending',
            message: `Ending "${option.endingId}" tidak ditemukan.`,
            nodeId: node.id,
            field: option.id,
          });
        }
      }
      const targets = new Set(
        node.options.map((o) => o.nextNodeId ?? (o.endingId ? `ending:${o.endingId}` : '')),
      );
      const hasEffects = node.options.some((o) => o.effects.length > 0);
      if (node.options.length > 1 && targets.size === 1 && !hasEffects) {
        push({
          severity: 'warning',
          code: 'choice-without-consequence',
          message: 'Semua pilihan menuju node yang sama dan tidak mengubah variabel apa pun.',
          nodeId: node.id,
        });
      }
    }

    if (node.type === 'ending' || node.type === 'failureEnding') {
      if (!endingIds.has(node.endingId)) {
        push({
          severity: 'error',
          code: 'missing-ending',
          message: `Ending "${node.endingId}" tidak ditemukan.`,
          nodeId: node.id,
          field: 'endingId',
        });
      }
    }

    if (node.type === 'incomingCall' || node.type === 'outgoingCall') {
      if (!callIds.has(node.callId)) {
        push({
          severity: 'error',
          code: 'missing-call',
          message: `Skenario telepon "${node.callId}" tidak ditemukan.`,
          nodeId: node.id,
          field: 'callId',
        });
      }
    }

    if (node.type === 'socialPost') {
      if (!postIds.has(node.postId)) {
        push({
          severity: 'error',
          code: 'missing-post',
          message: `Postingan "${node.postId}" tidak ditemukan.`,
          nodeId: node.id,
          field: 'postId',
        });
      }
    }
  }

  /* ------------------------------ content ------------------------------- */
  for (const contact of project.contacts) {
    if (!characterIds.has(contact.characterId)) {
      push({
        severity: 'error',
        code: 'missing-character',
        message: `Karakter "${contact.characterId}" untuk kontak "${contact.name}" tidak ditemukan.`,
        field: contact.id,
      });
    }
  }
  for (const chat of project.chats) {
    if (!contactIds.has(chat.contactId)) {
      push({
        severity: 'error',
        code: 'missing-contact',
        message: `Percakapan "${chat.id}" menunjuk kontak yang tidak ada.`,
        field: chat.id,
      });
    }
  }
  for (const item of project.scheduledMessages) {
    if (!chatIds.has(item.chatId)) {
      push({
        severity: 'error',
        code: 'missing-chat',
        message: `Pesan terjadwal "${item.id}" menunjuk percakapan yang tidak ada.`,
        field: item.id,
      });
    }
    if (!characterIds.has(item.characterId)) {
      push({
        severity: 'error',
        code: 'missing-character',
        message: `Pesan terjadwal "${item.id}" menunjuk karakter yang tidak ada.`,
        field: item.id,
      });
    }
  }
  for (const call of project.calls) {
    if (!contactIds.has(call.contactId)) {
      push({
        severity: 'error',
        code: 'missing-contact',
        message: `Panggilan "${call.id}" menunjuk kontak yang tidak ada.`,
        field: call.id,
      });
    }
  }

  /* --------------------------- variable usage --------------------------- */
  const usedVariables = new Set<string>();
  const usedFlags = new Set<string>();
  const visitCondition = (condition: Condition | undefined) => {
    collectConditionVariables(condition, usedVariables);
    collectConditionFlags(condition, usedFlags);
  };

  for (const node of project.nodes) {
    if (node.type === 'choice') {
      node.options.forEach((option) => {
        option.effects.forEach((e) => usedVariables.add(e.variableId));
        visitCondition(option.condition);
      });
      visitCondition(undefined);
    }
    if (node.type === 'variableUpdate') {
      node.effects.forEach((e) => usedVariables.add(e.variableId));
    }
    if (node.type === 'conditional') {
      node.branches.forEach((branch) => visitCondition(branch.condition));
    }
  }
  for (const item of project.scheduledMessages) visitCondition(item.condition);

  for (const variable of project.variables) {
    if (!usedVariables.has(variable.id)) {
      push({
        severity: 'warning',
        code: 'unused-variable',
        message: `Variabel "${variable.label}" tidak pernah dipakai.`,
        field: variable.id,
      });
    }
  }
  for (const used of usedVariables) {
    if (!variableIds.has(used)) {
      push({
        severity: 'error',
        code: 'undeclared-variable',
        message: `Variabel "${used}" dipakai tetapi tidak dideklarasikan.`,
        field: used,
      });
    }
  }
  for (const flag of usedFlags) {
    if (!ENGINE_FLAGS.has(flag)) {
      push({
        severity: 'warning',
        code: 'unknown-flag',
        message: `Flag "${flag}" tidak pernah diset oleh engine atau node mana pun.`,
        field: flag,
      });
    }
  }

  /* ----------------------------- reachability --------------------------- */
  const reachable = computeReachable(project);
  for (const node of project.nodes) {
    if (!reachable.has(node.id)) {
      push({
        severity: 'warning',
        code: 'unreachable-node',
        message: `Node "${node.title || node.id}" tidak dapat dicapai dari node awal.`,
        nodeId: node.id,
      });
    }
    if (node.type !== 'ending' && node.type !== 'failureEnding' && targetsOf(node).every((t) => !t.target)) {
      push({
        severity: 'error',
        code: 'dead-end',
        message: `Node "${node.title || node.id}" tidak punya jalan keluar dan bukan ending.`,
        nodeId: node.id,
      });
    }
  }
  const reachableEndings = new Set<string>();
  for (const node of project.nodes) {
    if (!reachable.has(node.id)) continue;
    if (node.type === 'ending' || node.type === 'failureEnding') {
      reachableEndings.add(node.endingId);
    }
    if (node.type === 'choice') {
      node.options.forEach((o) => o.endingId && reachableEndings.add(o.endingId));
    }
  }
  for (const ending of project.endings) {
    if (!reachableEndings.has(ending.id)) {
      push({
        severity: 'warning',
        code: 'unreachable-ending',
        message: `Ending "${ending.title}" tidak dapat dicapai.`,
        field: ending.id,
      });
    }
  }

  return issues;
}

export function computeReachable(project: StoryProject): Set<string> {
  const byId = new Map(project.nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const queue: string[] = [project.project.startNodeId];
  while (queue.length) {
    const id = queue.shift()!;
    if (!id || seen.has(id)) continue;
    const node = byId.get(id);
    if (!node) continue;
    seen.add(id);
    for (const { target } of targetsOf(node)) {
      if (target && !seen.has(target)) queue.push(target);
    }
  }
  return seen;
}

export function errorsOf(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.filter((i) => i.severity === 'error');
}
