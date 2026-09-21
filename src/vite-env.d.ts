/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Web3Forms public access key — the form's delivery address, obtained at
   * web3forms.com by entering the inbox the reports should land in.
   *
   * It is a PUBLIC key by design: it ships in the client bundle and can only
   * ever cause mail to be sent to the address it was issued for. Keeping it
   * in an env var is about being able to change the destination without a
   * code edit, not about secrecy.
   *
   * Unset (local dev, or a fork) the form falls back to the visitor's own
   * mail client — see src/lib/enquiry.ts.
   */
  readonly VITE_WEB3FORMS_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
