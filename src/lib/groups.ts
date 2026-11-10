import "server-only";

import { and, asc, count, eq, inArray, ne, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { safely } from "@/db/safe-query";
import { contactGroups, contacts, groups } from "@/db/schema";

// Every function takes the id of the signed-in user (session.ts) first and touches only that
// user's groups and contacts: someone else's group looks the same as one that doesn't exist

export type GroupWithCount = {
  id: number;
  name: string;
  contactCount: number;
};

function ownGroup(ownerId: string, groupId: number) {
  return and(eq(groups.id, groupId), eq(groups.ownerId, ownerId));
}

// All the user's groups by name, with how many contacts each one has
export async function listGroups(ownerId: string): Promise<GroupWithCount[]> {
  return getDb()
    .select({ id: groups.id, name: groups.name, contactCount: count(contactGroups.contactId) })
    .from(groups)
    .leftJoin(contactGroups, eq(contactGroups.groupId, groups.id))
    .where(eq(groups.ownerId, ownerId))
    .groupBy(groups.id)
    .orderBy(sql`lower(${groups.name})`);
}

export async function groupExists(ownerId: string, id: number): Promise<boolean> {
  const [row] = await getDb().select({ id: groups.id }).from(groups).where(ownGroup(ownerId, id));
  return Boolean(row);
}

export async function listContactGroupIds(ownerId: string, contactId: number): Promise<number[]> {
  const rows = await getDb()
    .select({ groupId: contactGroups.groupId })
    .from(contactGroups)
    .innerJoin(groups, eq(groups.id, contactGroups.groupId))
    .where(and(eq(contactGroups.contactId, contactId), eq(groups.ownerId, ownerId)));
  return rows.map((row) => row.groupId);
}

// Names of each contact's groups, in alphabetical order, for the rows of the list
export async function listGroupNamesByContact(ownerId: string): Promise<Map<number, string[]>> {
  const rows = await getDb()
    .select({ contactId: contactGroups.contactId, name: groups.name })
    .from(contactGroups)
    .innerJoin(groups, eq(groups.id, contactGroups.groupId))
    .where(eq(groups.ownerId, ownerId))
    .orderBy(asc(contactGroups.contactId), sql`lower(${groups.name})`);

  const namesByContact = new Map<number, string[]>();
  for (const { contactId, name } of rows) {
    namesByContact.set(contactId, [...(namesByContact.get(contactId) ?? []), name]);
  }
  return namesByContact;
}

// Both the contact and the group must be the user's: nothing happens otherwise
export async function addContactToGroup(
  ownerId: string,
  contactId: number,
  groupId: number,
): Promise<void> {
  const db = getDb();
  await db
    .insert(contactGroups)
    .select(
      db
        .select({ contactId: contacts.id, groupId: groups.id })
        .from(contacts)
        .innerJoin(groups, ownGroup(ownerId, groupId))
        .where(and(eq(contacts.id, contactId), eq(contacts.ownerId, ownerId))),
    )
    .onConflictDoNothing();
}

export async function removeContactFromGroup(
  ownerId: string,
  contactId: number,
  groupId: number,
): Promise<void> {
  const db = getDb();
  await db
    .delete(contactGroups)
    .where(
      and(
        eq(contactGroups.contactId, contactId),
        inArray(
          contactGroups.groupId,
          db.select({ id: groups.id }).from(groups).where(ownGroup(ownerId, groupId)),
        ),
      ),
    );
}

export type RenameResult = "renamed" | "not-found" | "taken";

const UNIQUE_VIOLATION = "23505";

// The name must not be taken by another group of the same user; other users don't matter
export async function renameGroup(
  ownerId: string,
  id: number,
  name: string,
): Promise<RenameResult> {
  const db = getDb();
  const [taken] = await safely(
    db
      .select({ id: groups.id })
      .from(groups)
      .where(
        and(
          eq(groups.ownerId, ownerId),
          sql`lower(${groups.name}) = lower(${name})`,
          ne(groups.id, id),
        ),
      ),
  );
  if (taken) return "taken";

  try {
    const [row] = await safely(
      db.update(groups).set({ name }).where(ownGroup(ownerId, id)).returning({ id: groups.id }),
    );
    return row ? "renamed" : "not-found";
  } catch (error) {
    // Another tab took the name between the check and the update
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) return "taken";
    throw error;
  }
}

export async function deleteGroup(ownerId: string, id: number): Promise<void> {
  await getDb().delete(groups).where(ownGroup(ownerId, id));
}

// Creates the user's group if they have none with this name, in any case of letters, and puts
// the contact in it
export async function addContactToNamedGroup(
  ownerId: string,
  contactId: number,
  name: string,
): Promise<void> {
  const db = getDb();
  await safely(db.insert(groups).values({ ownerId, name }).onConflictDoNothing());
  const [group] = await safely(
    db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.ownerId, ownerId), sql`lower(${groups.name}) = lower(${name})`)),
  );
  await addContactToGroup(ownerId, contactId, group.id);
}
