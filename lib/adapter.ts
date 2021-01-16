import type Knex from 'knex';
import type { Assertion, Model } from 'casbin';
import { Helper } from 'casbin';

type Policy = {
  [key: string]: string | undefined;

  ptype: string;
  v0?: string;
  v1?: string;
  v2?: string;
  v3?: string;
  v4?: string;
  v5?: string;
};

export class KnexAdapter {
  private readonly knex: Knex;
  private readonly tableName: string;

  constructor(knex: Knex, tableName = 'policies') {
    this.knex = knex;
    this.tableName = tableName;
  }

  static async newAdapter(knex: Knex): Promise<KnexAdapter> {
    const adapter = new KnexAdapter(knex);
    await adapter.createTable();

    return adapter;
  }

  private get policiesTable() {
    return this.knex('policies');
  }

  async createTable(): Promise<void> {
    const tableExists = await this.knex.schema.hasTable(this.tableName);
    if (!tableExists) {
      await this.knex.schema.createTable(this.tableName, (table) => {
        table.increments('id').primary();
        table.string('ptype').nullable();
        table.string('v0').nullable();
        table.string('v1').nullable();
        table.string('v2').nullable();
        table.string('v3').nullable();
        table.string('v4').nullable();
        table.string('v5').nullable();
      });
    }
  }

  async dropTable(): Promise<void> {
    await this.knex.schema.dropTableIfExists(this.tableName);
  }

  async close(): Promise<void> {
    await this.knex.destroy();
  }

  async loadPolicy(model: Model): Promise<void> {
    const policies = await this.policiesTable.select();

    for (const policy of policies) {
      loadPolicyLine(policy, model);
    }
  }

  async savePolicy(model: Model): Promise<void> {
    await this.dropTable();
    await this.createTable();

    await this.policiesTable.insert([
      ...createPoliciesFromAstMap(model.model.get('p')),
      ...createPoliciesFromAstMap(model.model.get('g')),
    ]);
  }

  async addPolicy(
    sec: string,
    ptype: string,
    rule: readonly string[]
  ): Promise<void> {
    const policy = createPolicy(ptype, rule);
    await this.policiesTable.insert(policy);
  }

  async removePolicy(
    sec: string,
    ptype: string,
    rule: readonly string[]
  ): Promise<void> {
    const policy = createPolicy(ptype, rule);
    await this.policiesTable.delete().where(policy);
  }

  async removeFilteredPolicy(
    sec: string,
    ptype: string,
    fieldIndex: number,
    ...fieldValues: string[]
  ): Promise<void> {
    const filteredPolicy = createFilteredPolicy(
      ptype,
      fieldIndex,
      ...fieldValues
    );
    await this.policiesTable.delete().where(filteredPolicy);
  }
}

function loadPolicyLine(policy: Policy, model: Model): void {
  const policyLine =
    policy.ptype +
    ', ' +
    [policy.v0, policy.v1, policy.v2, policy.v3, policy.v4, policy.v5]
      .filter((v) => v)
      .join(', ');

  Helper.loadPolicyLine(policyLine, model);
}

function createPolicy(ptype: string, rule: readonly string[]): Policy {
  if (rule.length === 3) {
    return {
      ptype,
      v0: rule[0],
      v1: rule[1],
      v2: rule[2],
    };
  }

  return rule.reduce(
    (acc: Policy, value, index) => {
      acc[`v${index}`] = rule[index];
      return acc;
    },
    { ptype }
  );
}

function createPoliciesFromAstMap(
  astMap: Map<string, Assertion> | undefined
): Policy[] {
  const policies: Policy[] = [];
  if (!astMap) {
    return policies;
  }

  for (const [ptype, ast] of astMap) {
    for (const rule of ast.policy) {
      policies.push(createPolicy(ptype, rule));
    }
  }
  return policies;
}

function createFilteredPolicy(
  ptype: string,
  fieldIndex: number,
  ...fieldValues: string[]
): Policy {
  const filteredPolicy: Policy = { ptype };

  if (fieldIndex <= 0 && 0 < fieldIndex + fieldValues.length) {
    filteredPolicy.v0 = fieldValues[0 - fieldIndex];
  }
  if (fieldIndex <= 1 && 1 < fieldIndex + fieldValues.length) {
    filteredPolicy.v1 = fieldValues[1 - fieldIndex];
  }
  if (fieldIndex <= 2 && 2 < fieldIndex + fieldValues.length) {
    filteredPolicy.v2 = fieldValues[2 - fieldIndex];
  }
  if (fieldIndex <= 3 && 3 < fieldIndex + fieldValues.length) {
    filteredPolicy.v3 = fieldValues[3 - fieldIndex];
  }
  if (fieldIndex <= 4 && 4 < fieldIndex + fieldValues.length) {
    filteredPolicy.v4 = fieldValues[4 - fieldIndex];
  }
  if (fieldIndex <= 5 && 5 < fieldIndex + fieldValues.length) {
    filteredPolicy.v5 = fieldValues[5 - fieldIndex];
  }

  return filteredPolicy;
}
