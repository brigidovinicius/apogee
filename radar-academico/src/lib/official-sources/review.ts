/** Compatibility for old server-action references. Publication no longer has a review gate. */
export class OpportunityReviewError extends Error {}
export async function decideOpportunity(_input: { id: unknown; decision: unknown; reviewer: unknown }): Promise<never> {
  void _input;
  throw new OpportunityReviewError("A revisão foi substituída pelo gerenciamento do catálogo");
}
