/**
 * PersonalityProfile
 *
 * Stores parameters that control the AI's behavior and tone.
 */
export class PersonalityProfile {
  curiosity = 0.5;
  humour = 0.5;
  prudence = 0.5;
  autonomy = 0.5;
  sociability = 0.5;

  toString() {
    return `Personality(curiosity=${this.curiosity}, humour=${this.humour}, prudence=${this.prudence}, autonomy=${this.autonomy}, sociability=${this.sociability})`;
  }

  // TODO: persistence and dynamic adaptation
}
