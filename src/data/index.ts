export interface HealthRepository { check(): Promise<boolean>; }
