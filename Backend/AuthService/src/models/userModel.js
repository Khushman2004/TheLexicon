export class User {
  constructor({
    id = null,
    username = "",
    email = "",
    passwordHash = "",
    fullName = null,
    bio = null,
    avatarUrl = null,
    isPublic = true,
    createdAt = new Date(),
    updatedAt = new Date(),
  } = {}) {
    this.id = id;
    this.username = username;
    this.email = email;
    this.passwordHash = passwordHash;
    this.fullName = fullName;
    this.bio = bio;
    this.avatarUrl = avatarUrl;
    this.isPublic = isPublic;
    this.createdAt = new Date(createdAt);
    this.updatedAt = new Date(updatedAt);
  }

  toJSON() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      passwordHash: this.passwordHash,
      fullName: this.fullName,
      bio: this.bio,
      avatarUrl: this.avatarUrl,
      isPublic: this.isPublic,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  toPublicJSON() {
    const { passwordHash, ...user } = this.toJSON();
    return user;
  }
}
