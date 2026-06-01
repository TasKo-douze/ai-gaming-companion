/**
 * PersonalityManager
 *
 * Manages the personality profile and behavior modifiers.
 */
import { PersonalityProfile } from '../personality/PersonalityProfile';

export class PersonalityManager {
  private profile: PersonalityProfile;

  constructor() {
    this.profile = new PersonalityProfile();
  }

  getProfile() {
    return this.profile;
  }

  // TODO: methods to mutate personality based on events and learning
}
