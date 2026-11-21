export type SignatureMode = 'ELECTRONIC_SIMPLE' | 'PSRE_CERTIFIED';

export type PsreProviderId = 'NONE' | 'PRIVY' | 'VIDA' | 'PERURI' | 'TEKENSIGN' | 'CUSTOM';

export interface PartySignatureData {
  signed: boolean;
  signerName: string;
  signerTitle: string;
  signerEmail: string;
  signedAt: string;
  consentAccepted: boolean;
  consentStatement: string;
  verificationMethod: 'EXPLICIT_CONSENT' | 'EMAIL_OTP_VERIFIED' | 'PSRE_CERTIFIED';
  verificationNote: string;
  signatureImageDataUrl: string; // Transparent PNG black ink
  documentHashAtSigning: string;
  documentVersionAtSigning: number;
  certifiedStatus: 'UNVERIFIED_SIMPLE_ESIGN' | 'PENDING_PSRE' | 'CERTIFIED_PSRE';
  certificateSerial?: string;
}

export interface PsreIntegrationConfig {
  mode: SignatureMode;
  provider: PsreProviderId;
  providerDisplayName: string;
  apiBaseUrl: string;
  environment: 'SANDBOX' | 'PRODUCTION';
  apiKeyConfigured: boolean;
  webhookCallbackUrl: string;
  integrationNote: string;
}

export interface SignatureState {
  firstParty: PartySignatureData;
  secondParty: PartySignatureData;
  psre: PsreIntegrationConfig;
}
