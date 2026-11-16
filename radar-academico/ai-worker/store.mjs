/** All writes use restricted, transactional PostgreSQL functions; no catalogue credentials. */
export class AiStore {
  constructor(query) { this.query = query; }
  async status() { return (await this.query('select radar_ai.status() as result')).rows[0].result; }
  async reserve(request) {
    return (await this.query('select radar_ai.reserve($1,$2,$3,$4,$5,$6,$7,$8) as result',
      [request.key, request.envelope, request.requestHash, request.model, request.inputBound, request.outputLimit, request.stream ?? 'radar', request.purpose ?? 'normal'])).rows[0].result;
  }
  async markSent(id) { return (await this.query('select radar_ai.mark_sent($1) as result', [id])).rows[0].result; }
  async finish(id, outcome, cost = null, reason = null, receipt = null) {
    if (outcome === 'confirmed' && receipt) return (await this.query('select radar_ai.finish_response($1,$2,$3) as result', [id, cost, receipt])).rows[0].result;
    return (await this.query('select radar_ai.finish($1,$2,$3,$4) as result', [id, outcome, cost, reason])).rows[0].result;
  }
  async recover() { return (await this.query('select radar_ai.recover() as result')).rows[0].result; }
  async claimTask() { return (await this.query('select radar_ai.claim_task() as result')).rows[0].result; }
  async attachTask(id, token, operation) { return (await this.query('select radar_ai.attach_task($1,$2,$3) as result', [id, token, operation])).rows[0].result; }
  async completeTask(id, token, value) { return (await this.query('select radar_ai.complete_task($1,$2,$3) as result', [id, token, value])).rows[0].result; }
  async deferTask(id, token) { return (await this.query('select radar_ai.defer_task($1,$2) as result', [id, token])).rows[0].result; }
}
