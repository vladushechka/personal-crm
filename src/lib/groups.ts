import "server-only";

import { and, asc, count, eq, ne, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { safely } from "@/db/safe-query";
import { contactGroups, groups } from "@/db/schema";

export type GroupWithCount = {
  id: number;
  name: string;
  contactCount: number;
};

// All groups by name, with how many contacts each one has
export async function listGroups(): Promise<GroupWithCount[]> {
  return getDb()
    .select({ id: groups.id, name: groups.name, contactCount: count(contactGroups.contactId) })
    .from(groups)
    .leftJoin(contactGroups, eq(contactGroups.groupId, groups.id))
    .groupBy(groups.id)
    .orderBy(sql`lower(${groups.name})`);
}

export async function groupExists(id: number): Promise<boolean> {
  const [row] = await getDb().select({ id: groups.id }).from(groups).where(eq(groups.id, id));
  return Boolean(row);
}

export async function listContactGroupIds(contactId: number): Promise<number[]> {
  const rows = await getDb()
    .select({ groupId: contactGroups.groupId })
    .from(contactGroups)
    .where(eq(contactGroups.contactId, contactId));
  return rows.map((row) => row.groupId);
}

// Names of each contact's groups, in alphabetical order, for the rows of the list
export async function listGroupNamesByContact(): Promise<Map<number, string[]>> {
  const rows = await getDb()
    .select({ contactId: contactGroups.contactId, name: groups.name })
    .from(contactGroups)
    .innerJoin(groups, eq(groups.id, contactGroups.groupId))
    .orderBy(asc(contactGroups.contactId), sql`lower(${groups.name})`);

  const namesByContact = new Map<number, string[]>();
  for (const { contactId, name } of rows) {
    namesByContact.set(contactId, [...(namesByContact.get(contactId) ?? []), name]);
  }
  return namesByContact;
}

export async function addContactToGroup(contactId: number, groupId: number): Promise<void> {
  await getDb().insert(contactGroups).values({ contactId, groupId }).onConflictDoNothing();
}

export async function removeContactFromGroup(contactId: number, groupId: number): Promise<void> {
  await getDb()
    .delete(contactGroups)
    .where(and(eq(contactGroups.contactId, contactId), eq(contactGroups.groupId, groupId)));
}

export type RenameResult = "renamed" | "not-found" | "taken";

const UNIQUE_VIOLATION = "23505";

export async function renameGroup(id: number, name: string): Promise<RenameResult> {
  const db = getDb();
  const [taken] = await safely(
    db
      .select({ id: groups.id })
      .from(groups)
      .where(and(sql`lower(${groups.name}) = lower(${name})`, ne(groups.id, id))),
  );
  if (taken) return "taken";

  try {
    const [row] = await safely(
      db.update(groups).set({ name }).where(eq(groups.id, id)).returning({ id: groups.id }),
    );
    return row ? "renamed" : "not-found";
  } catch (error) {
    // Another tab took the name between the check and the update
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) return "taken";
    throw error;
  }
}

export async function deleteGroup(id: number): Promise<void> {
  await getDb().delete(groups).where(eq(groups.id, id));
}

// Creates the group if there is none with this name, in any case of letters, and puts the contact in it
export async function addContactToNamedGroup(contactId: number, name: string): Promise<void> {
  const db = getDb();
  await safely(db.insert(groups).values({ name }).onConflictDoNothing());
  const [group] = await safely(
    db
      .select({ id: groups.id })
      .from(groups)
      .where(sql`lower(${groups.name}) = lower(${name})`),
  );
  await addContactToGroup(contactId, group.id);
}
