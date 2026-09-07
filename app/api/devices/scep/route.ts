import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import forge from "node-forge";

export const runtime = "nodejs";

/*
|--------------------------------------------------------------------------
| Environment
|--------------------------------------------------------------------------
*/

const CA_CERT_BASE64 =
  process.env.ONLYSIGN_CA_CERT_BASE64;

const CA_KEY_BASE64 =
  process.env.ONLYSIGN_CA_KEY_BASE64;

/*
|--------------------------------------------------------------------------
| SCEP OIDs
|--------------------------------------------------------------------------
*/

const SCEP = {
  messageType: "2.16.840.1.113733.1.9.2",
  pkiStatus: "2.16.840.1.113733.1.9.3",
  senderNonce: "2.16.840.1.113733.1.9.5",
  recipientNonce: "2.16.840.1.113733.1.9.6",
  transactionId: "2.16.840.1.113733.1.9.7",
} as const;

const OID = {
  data: forge.pki.oids.data,
  signedData: forge.pki.oids.signedData,
  sha256: forge.pki.oids.sha256,
  rsaEncryption: forge.pki.oids.rsaEncryption,
} as const;

/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

type ForgeCertificateRequest =
  ReturnType<
    typeof forge.pki.certificationRequestFromAsn1
  >;

type ParsedScepRequest = {
  transactionId: string;
  messageType: string;
  senderNonce: string;
  deviceCertificate: forge.pki.Certificate;
  encryptedContent: string;
};

type Asn1Value =
  | forge.asn1.Asn1
  | string;

type Asn1Children =
  | forge.asn1.Asn1[]
  | string;

/*
|--------------------------------------------------------------------------
| Binary helpers
|--------------------------------------------------------------------------
*/

function getBase64Env(
  value: string | undefined,
  name: string
): string {
  if (!value) {
    throw new Error(
      `${name} non configurata.`
    );
  }

  return value.trim();
}

function decodeBase64Env(
  value: string | undefined,
  name: string
): string {
  return forge.util.decode64(
    getBase64Env(value, name)
  );
}

function binaryToUint8Array(
  binary: string
): Uint8Array {
  const result =
    new Uint8Array(binary.length);

  for (
    let index = 0;
    index < binary.length;
    index++
  ) {
    result[index] =
      binary.charCodeAt(index) & 0xff;
  }

  return result;
}

function uint8ArrayToBinary(
  bytes: Uint8Array
): string {
  let result = "";

  for (
    let index = 0;
    index < bytes.length;
    index++
  ) {
    result += String.fromCharCode(
      bytes[index]
    );
  }

  return result;
}

function derToBinary(
  value: forge.asn1.Asn1
): string {
  return forge.asn1
    .toDer(value)
    .getBytes();
}

function sha256Binary(
  value: string
): string {
  const hash =
    createHash("sha256")
      .update(
        Buffer.from(value, "binary")
      )
      .digest();

  return uint8ArrayToBinary(
    new Uint8Array(hash)
  );
}

/*
|--------------------------------------------------------------------------
| ASN.1 type guards
|--------------------------------------------------------------------------
*/

function isAsn1(
  value: Asn1Value
): value is forge.asn1.Asn1 {
  return (
    typeof value !== "string"
  );
}

function isAsn1Array(
  value: Asn1Children
): value is forge.asn1.Asn1[] {
  return Array.isArray(value);
}

/*
|--------------------------------------------------------------------------
| ASN.1 builders
|--------------------------------------------------------------------------
*/

function asn1Integer(
  value: number
): forge.asn1.Asn1 {
  return forge.asn1.create(
    forge.asn1.Class.UNIVERSAL,
    forge.asn1.Type.INTEGER,
    false,
    forge.asn1
      .integerToDer(value)
      .getBytes()
  );
}

function asn1Null(): forge.asn1.Asn1 {
  return forge.asn1.create(
    forge.asn1.Class.UNIVERSAL,
    forge.asn1.Type.NULL,
    false,
    ""
  );
}

function asn1Oid(
  oid: string
): forge.asn1.Asn1 {
  return forge.asn1.create(
    forge.asn1.Class.UNIVERSAL,
    forge.asn1.Type.OID,
    false,
    forge.asn1
      .oidToDer(oid)
      .getBytes()
  );
}

function asn1OctetString(
  value: string
): forge.asn1.Asn1 {
  return forge.asn1.create(
    forge.asn1.Class.UNIVERSAL,
    forge.asn1.Type.OCTETSTRING,
    false,
    value
  );
}

function asn1PrintableString(
  value: string
): forge.asn1.Asn1 {
  return forge.asn1.create(
    forge.asn1.Class.UNIVERSAL,
    forge.asn1.Type.PRINTABLESTRING,
    false,
    value
  );
}

function asn1Sequence(
  values: forge.asn1.Asn1[]
): forge.asn1.Asn1 {
  return forge.asn1.create(
    forge.asn1.Class.UNIVERSAL,
    forge.asn1.Type.SEQUENCE,
    true,
    values
  );
}

function asn1Set(
  values: forge.asn1.Asn1[]
): forge.asn1.Asn1 {
  return forge.asn1.create(
    forge.asn1.Class.UNIVERSAL,
    forge.asn1.Type.SET,
    true,
    values
  );
}

function asn1Context(
  tag: number,
  values: forge.asn1.Asn1[],
  constructed = true
): forge.asn1.Asn1 {
  return forge.asn1.create(
    forge.asn1.Class.CONTEXT_SPECIFIC,
    tag,
    constructed,
    values
  );
}

/*
|--------------------------------------------------------------------------
| CA loading
|--------------------------------------------------------------------------
*/

function loadCaCertificate():
  forge.pki.Certificate {
  const binary =
    decodeBase64Env(
      CA_CERT_BASE64,
      "ONLYSIGN_CA_CERT_BASE64"
    );

  let text = "";

  try {
    text =
      forge.util.decodeUtf8(binary);
  } catch {
    text = "";
  }

  if (
    text.includes(
      "-----BEGIN CERTIFICATE-----"
    )
  ) {
    return forge.pki.certificateFromPem(
      text
    );
  }

  return forge.pki.certificateFromAsn1(
    forge.asn1.fromDer(binary)
  );
}

function loadCaPrivateKey():
  forge.pki.rsa.PrivateKey {
  const binary =
    decodeBase64Env(
      CA_KEY_BASE64,
      "ONLYSIGN_CA_KEY_BASE64"
    );

  let text = "";

  try {
    text =
      forge.util.decodeUtf8(binary);
  } catch {
    text = "";
  }

  if (
    text.includes(
      "-----BEGIN RSA PRIVATE KEY-----"
    ) ||
    text.includes(
      "-----BEGIN PRIVATE KEY-----"
    )
  ) {
    return forge.pki.privateKeyFromPem(
      text
    ) as forge.pki.rsa.PrivateKey;
  }

  throw new Error(
    "ONLYSIGN_CA_KEY_BASE64 non contiene una chiave privata PEM supportata."
  );
}

/*
|--------------------------------------------------------------------------
| Certificate
|--------------------------------------------------------------------------
*/

function certificateDer(
  certificate: forge.pki.Certificate
): string {
  return derToBinary(
    forge.pki.certificateToAsn1(
      certificate
    )
  );
}

function createIssuedCertificate(
  csr: ForgeCertificateRequest,
  caCertificate: forge.pki.Certificate,
  caPrivateKey: forge.pki.rsa.PrivateKey
): forge.pki.Certificate {
  if (!csr.publicKey) {
    throw new Error(
      "SCEP: il CSR non contiene una chiave pubblica."
    );
  }

  const certificate =
    forge.pki.createCertificate();

  certificate.publicKey =
    csr.publicKey;

  const serialBytes =
    new Uint8Array(
      randomBytes(16)
    );

  certificate.serialNumber =
    forge.util.bytesToHex(
      uint8ArrayToBinary(
        serialBytes
      )
    );

  const now =
    new Date();

  certificate.validity.notBefore =
    new Date(
      now.getTime() -
        5 * 60 * 1000
    );

  certificate.validity.notAfter =
    new Date(
      now.getTime() +
        365 * 24 * 60 * 60 * 1000
    );

  certificate.setSubject(
    csr.subject.attributes
  );

  certificate.setIssuer(
    caCertificate.subject.attributes
  );

  certificate.setExtensions([
    {
      name: "basicConstraints",
      cA: false,
    },
    {
      name: "keyUsage",
      digitalSignature: true,
      keyEncipherment: true,
    },
    {
      name: "extKeyUsage",
      clientAuth: true,
    },
    {
      name: "subjectKeyIdentifier",
    },
    {
      name: "authorityKeyIdentifier",
      authorityCertIssuer: true,
      serialNumber:
        caCertificate.serialNumber,
    },
  ]);

  certificate.sign(
    caPrivateKey,
    forge.md.sha256.create()
  );

  return certificate;
}

/*
|--------------------------------------------------------------------------
| CMS parsing
|--------------------------------------------------------------------------
*/

function findSignedData(
  root: forge.asn1.Asn1
): forge.asn1.Asn1 {
  if (
    !isAsn1Array(root.value)
  ) {
    throw new Error(
      "SCEP: ContentInfo non valido."
    );
  }

  const wrapper =
    root.value[1];

  if (
    !wrapper ||
    !isAsn1(wrapper)
  ) {
    throw new Error(
      "SCEP: SignedData wrapper mancante."
    );
  }

  if (
    wrapper.tagClass !==
      forge.asn1.Class.CONTEXT_SPECIFIC ||
    wrapper.type !== 0
  ) {
    throw new Error(
      "SCEP: SignedData wrapper non valido."
    );
  }

  if (
    !isAsn1Array(wrapper.value)
  ) {
    throw new Error(
      "SCEP: SignedData wrapper vuoto."
    );
  }

  const signedData =
    wrapper.value[0];

  if (!signedData) {
    throw new Error(
      "SCEP: SignedData mancante."
    );
  }

  return signedData;
}

function findSignerInfo(
  signedData: forge.asn1.Asn1
): forge.asn1.Asn1 {
  if (
    !isAsn1Array(
      signedData.value
    )
  ) {
    throw new Error(
      "SCEP: SignedData non valido."
    );
  }

  const signerInfos =
    signedData.value[
      signedData.value.length - 1
    ];

  if (
    !signerInfos ||
    !isAsn1(signerInfos) ||
    signerInfos.type !==
      forge.asn1.Type.SET
  ) {
    throw new Error(
      "SCEP: SignerInfos non trovato."
    );
  }

  if (
    !isAsn1Array(
      signerInfos.value
    )
  ) {
    throw new Error(
      "SCEP: SignerInfos non valido."
    );
  }

  const signerInfo =
    signerInfos.value[0];

  if (!signerInfo) {
    throw new Error(
      "SCEP: SignerInfo non trovato."
    );
  }

  return signerInfo;
}

/*
|--------------------------------------------------------------------------
| SCEP authenticated attributes
|--------------------------------------------------------------------------
*/

function extractAttribute(
  signerInfo: forge.asn1.Asn1,
  oid: string
): forge.asn1.Asn1 | null {
  if (
    !isAsn1Array(
      signerInfo.value
    )
  ) {
    throw new Error(
      "SCEP: SignerInfo non valido."
    );
  }

  const authenticatedAttributes =
    signerInfo.value[3];

  if (
    !authenticatedAttributes ||
    !isAsn1(
      authenticatedAttributes
    )
  ) {
    return null;
  }

  if (
    authenticatedAttributes.tagClass !==
      forge.asn1.Class.CONTEXT_SPECIFIC ||
    authenticatedAttributes.type !== 0
  ) {
    return null;
  }

  if (
    !isAsn1Array(
      authenticatedAttributes.value
    )
  ) {
    return null;
  }

  for (
    const attribute
      of authenticatedAttributes.value
  ) {
    if (
      !isAsn1(attribute)
    ) {
      continue;
    }

    if (
      attribute.type !==
        forge.asn1.Type.SEQUENCE ||
      !isAsn1Array(
        attribute.value
      )
    ) {
      continue;
    }

    if (
      attribute.value.length < 2
    ) {
      continue;
    }

    const oidNode =
      attribute.value[0];

    if (
      !isAsn1(oidNode) ||
      typeof oidNode.value !==
        "string"
    ) {
      continue;
    }

    const attributeOid =
      forge.asn1.derToOid(
        oidNode.value
      );

    if (
      attributeOid !== oid
    ) {
      continue;
    }

    const values =
      attribute.value[1];

    if (
      !isAsn1(values) ||
      values.type !==
        forge.asn1.Type.SET ||
      !isAsn1Array(
        values.value
      ) ||
      values.value.length === 0
    ) {
      return null;
    }

    return values.value[0] ?? null;
  }

  return null;
}

function attributeString(
  attribute: forge.asn1.Asn1 | null
): string | null {
  if (
    !attribute ||
    typeof attribute.value !==
      "string"
  ) {
    return null;
  }

  return attribute.value;
}

function attributeBinary(
  attribute: forge.asn1.Asn1 | null
): string | null {
  if (
    !attribute ||
    typeof attribute.value !==
      "string"
  ) {
    return null;
  }

  return attribute.value;
}

/*
|--------------------------------------------------------------------------
| Find encrypted SCEP content
|--------------------------------------------------------------------------
*/

function findEncryptedContent(
  signedData: forge.asn1.Asn1
): string {
  if (
    !isAsn1Array(
      signedData.value
    )
  ) {
    throw new Error(
      "SCEP: SignedData non valido."
    );
  }

  const contentInfo =
    signedData.value[2];
    console.log(
  "=== SCEP CONTENT INFO ASN1 ==="
);

console.dir(
  contentInfo,
  {
    depth: 8
  }
);

console.log(
  "=== END SCEP CONTENT INFO ASN1 ==="
);

  if (
    !contentInfo ||
    !isAsn1(contentInfo) ||
    !isAsn1Array(
      contentInfo.value
    )
  ) {
    throw new Error(
      "SCEP: ContentInfo non trovato."
    );
  }

  const wrapper =
    contentInfo.value[1];

  if (
    !wrapper ||
    !isAsn1(wrapper) ||
    !isAsn1Array(
      wrapper.value
    )
  ) {
    throw new Error(
      "SCEP: eContent wrapper mancante."
    );
  }

  const content =
    wrapper.value[0];

  if (
    !content ||
    !isAsn1(content)
  ) {
    throw new Error(
      "SCEP: eContent mancante."
    );
  }

  if (
    content.type !==
      forge.asn1.Type.OCTETSTRING ||
    typeof content.value !==
      "string"
  ) {
    throw new Error(
      "SCEP: eContent non è OCTET STRING."
    );
  }

  return content.value;
}

/*
|--------------------------------------------------------------------------
| Device certificate
|--------------------------------------------------------------------------
*/

function findDeviceCertificate(
  signedData: forge.asn1.Asn1
): forge.pki.Certificate {
  if (
    !isAsn1Array(
      signedData.value
    )
  ) {
    throw new Error(
      "SCEP: SignedData non valido."
    );
  }

  const certificateSet =
    signedData.value.find(
      (
        item
      ): item is forge.asn1.Asn1 =>
        isAsn1(item) &&
        item.tagClass ===
          forge.asn1.Class.CONTEXT_SPECIFIC &&
        item.type === 0
    );

  if (!certificateSet) {
    throw new Error(
      "SCEP: certificati device non presenti."
    );
  }

  if (
    !isAsn1Array(
      certificateSet.value
    )
  ) {
    throw new Error(
      "SCEP: CertificateSet non valido."
    );
  }

  const certificateAsn1 =
    certificateSet.value[0];

  if (
    !certificateAsn1 ||
    !isAsn1(certificateAsn1)
  ) {
    throw new Error(
      "SCEP: certificato device non trovato."
    );
  }

  return forge.pki.certificateFromAsn1(
    certificateAsn1
  );
}

/*
|--------------------------------------------------------------------------
| Parse SCEP request
|--------------------------------------------------------------------------
*/

function parseScepRequest(
  binary: string
): ParsedScepRequest {
  const root =
    forge.asn1.fromDer(binary);

  const signedData =
    findSignedData(root);

  const signerInfo =
    findSignerInfo(
      signedData
    );

  const transactionId =
    attributeString(
      extractAttribute(
        signerInfo,
        SCEP.transactionId
      )
    );

  const messageType =
    attributeString(
      extractAttribute(
        signerInfo,
        SCEP.messageType
      )
    );

  const senderNonce =
    attributeBinary(
      extractAttribute(
        signerInfo,
        SCEP.senderNonce
      )
    );

  if (!transactionId) {
    throw new Error(
      "SCEP: transactionID mancante."
    );
  }

  if (!messageType) {
    throw new Error(
      "SCEP: messageType mancante."
    );
  }

  if (!senderNonce) {
    throw new Error(
      "SCEP: senderNonce mancante."
    );
  }

  if (
    messageType !== "19"
  ) {
    throw new Error(
      `SCEP: messageType inatteso: ${messageType}`
    );
  }

  return {
    transactionId,
    messageType,
    senderNonce,
    deviceCertificate:
      findDeviceCertificate(
        signedData
      ),
    encryptedContent:
      findEncryptedContent(
        signedData
      ),
  };
}

/*
|--------------------------------------------------------------------------
| CSR
|--------------------------------------------------------------------------
*/

function parseCsr(
  binary: string
): ForgeCertificateRequest {
  return forge.pki.certificationRequestFromAsn1(
    forge.asn1.fromDer(binary)
  );
}

function getChallengePassword(
  csr: ForgeCertificateRequest
): string | null {
  const attribute =
    csr.getAttribute({
      name:
        "challengePassword",
    });

  if (!attribute) {
    return null;
  }

  return typeof attribute.value ===
    "string"
    ? attribute.value
    : null;
}

/*
|--------------------------------------------------------------------------
| Certificates-only CMS
|--------------------------------------------------------------------------
*/

function createCertificatesOnlyCms(
  issuedCertificate: forge.pki.Certificate,
  caCertificate: forge.pki.Certificate
): string {
  const signedData =
    forge.pkcs7.createSignedData();

  signedData.addCertificate(
    issuedCertificate
  );

  signedData.addCertificate(
    caCertificate
  );

  return derToBinary(
    signedData.toAsn1()
  );
}

/*
|--------------------------------------------------------------------------
| CMS EnvelopedData
|--------------------------------------------------------------------------
*/

function createEnvelopedCms(
  content: string,
  deviceCertificate: forge.pki.Certificate
): string {
  const envelope =
    forge.pkcs7.createEnvelopedData();

  envelope.addRecipient(
    deviceCertificate
  );

  envelope.content =
    forge.util.createBuffer(
      content
    );

  envelope.encrypt(
    undefined,
    forge.pki.oids["aes128-CBC"]
  );

  return derToBinary(
    envelope.toAsn1()
  );
}

/*
|--------------------------------------------------------------------------
| CMS attribute
|--------------------------------------------------------------------------
*/

function cmsAttribute(
  oid: string,
  value: forge.asn1.Asn1
): forge.asn1.Asn1 {
  return asn1Sequence([
    asn1Oid(oid),
    asn1Set([
      value,
    ]),
  ]);
}

/*
|--------------------------------------------------------------------------
| SCEP CertRep
|--------------------------------------------------------------------------
*/

function createCertRep(
  transactionId: string,
  recipientNonce: string,
  issuedCertificate: forge.pki.Certificate,
  caCertificate: forge.pki.Certificate,
  caPrivateKey: forge.pki.rsa.PrivateKey,
  deviceCertificate: forge.pki.Certificate
): Uint8Array {
  /*
   * 1. Certificates-only CMS
   */

  const certificateCms =
    createCertificatesOnlyCms(
      issuedCertificate,
      caCertificate
    );

  /*
   * 2. Encrypt for iPhone
   */

  const encryptedCms =
    createEnvelopedCms(
      certificateCms,
      deviceCertificate
    );

  /*
   * 3. CMS messageDigest
   */

  const messageDigest =
    sha256Binary(
      encryptedCms
    );

  /*
   * 4. Authenticated attributes
   */

  const authenticatedAttributes =
    [
      cmsAttribute(
        forge.pki.oids.contentType,
        asn1Oid(
          OID.data
        )
      ),

      cmsAttribute(
        forge.pki.oids.messageDigest,
        asn1OctetString(
          messageDigest
        )
      ),

      cmsAttribute(
        SCEP.messageType,
        asn1PrintableString(
          "3"
        )
      ),

      cmsAttribute(
        SCEP.pkiStatus,
        asn1PrintableString(
          "0"
        )
      ),

      cmsAttribute(
        SCEP.transactionId,
        asn1PrintableString(
          transactionId
        )
      ),

      cmsAttribute(
        SCEP.recipientNonce,
        asn1OctetString(
          recipientNonce
        )
      ),
    ];

  /*
   * 5. DER SET OF authenticated attributes
   */

  const attributesSet =
    asn1Set(
      authenticatedAttributes
    );

  const attributesDer =
    derToBinary(
      attributesSet
    );

  /*
   * 6. Sign attributes
   */

  const digest =
    forge.md.sha256.create();

  digest.update(
    attributesDer,
    "raw"
  );

  const signature =
    caPrivateKey.sign(
      digest,
      "RSASSA-PKCS1-V1_5"
    );

  /*
   * 7. SignerInfo
   */

  const issuer =
    forge.pki.distinguishedNameToAsn1({
      attributes:
        caCertificate.subject.attributes,
    });

  const signerInfo =
    asn1Sequence([
      asn1Integer(1),

      asn1Sequence([
        issuer,

        forge.asn1.create(
          forge.asn1.Class.UNIVERSAL,
          forge.asn1.Type.INTEGER,
          false,
          forge.util.hexToBytes(
            caCertificate.serialNumber
          )
        ),
      ]),

      asn1Sequence([
        asn1Oid(
          OID.sha256
        ),
        asn1Null(),
      ]),

      /*
       * [0] IMPLICIT SET OF attributes
       */

      asn1Context(
        0,
        authenticatedAttributes
      ),

      asn1Sequence([
        asn1Oid(
          OID.rsaEncryption
        ),
        asn1Null(),
      ]),

      asn1OctetString(
        signature
      ),
    ]);

  /*
   * 8. DigestAlgorithms
   */

  const digestAlgorithms =
    asn1Set([
      asn1Sequence([
        asn1Oid(
          OID.sha256
        ),
        asn1Null(),
      ]),
    ]);

  /*
   * 9. ContentInfo
   */

  const contentInfo =
    asn1Sequence([
      asn1Oid(
        OID.data
      ),

      asn1Context(
        0,
        [
          asn1OctetString(
            encryptedCms
          ),
        ]
      ),
    ]);

  /*
   * 10. Certificates
   */

  const certificates =
    asn1Context(
      0,
      [
        forge.pki.certificateToAsn1(
          caCertificate
        ),
      ]
    );

  /*
   * 11. SignedData
   */

  const signedData =
    asn1Sequence([
      asn1Integer(1),
      digestAlgorithms,
      contentInfo,
      certificates,
      asn1Set([
        signerInfo,
      ]),
    ]);

  /*
   * 12. Root ContentInfo
   */

  const root =
    asn1Sequence([
      asn1Oid(
        OID.signedData
      ),

      asn1Context(
        0,
        [
          signedData,
        ]
      ),
    ]);

  return binaryToUint8Array(
    derToBinary(root)
  );
}

/*
|--------------------------------------------------------------------------
| GET
|--------------------------------------------------------------------------
*/

export async function GET(
  request: Request
) {
  try {
    const url =
      new URL(request.url);

    const operation =
      url.searchParams.get(
        "operation"
      );

    console.log(
      "=== SCEP GET ==="
    );

    console.log(
      "Operation:",
      operation
    );

    /*
     * GetCACaps
     */

    if (
      operation ===
      "GetCACaps"
    ) {
      const capabilities =
        [
          "POSTPKIOperation",
          "SHA-256",
          "AES",
        ].join("\r\n") +
        "\r\n";

      return new NextResponse(
        capabilities,
        {
          status: 200,

          headers: {
            "Content-Type":
              "text/plain",

            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    /*
     * GetCACert
     */

    if (
      operation ===
      "GetCACert"
    ) {
      const caCertificate =
        loadCaCertificate();

      const caBytes =
        binaryToUint8Array(
          certificateDer(
            caCertificate
          )
        );

      console.log(
        "CA certificate size:",
        caBytes.byteLength
      );

      return new NextResponse(
        Buffer.from(
          caBytes
        ),
        {
          status: 200,

          headers: {
            "Content-Type":
              "application/x-x509-ca-cert",

            "Content-Length":
              caBytes.byteLength.toString(),

            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    return new NextResponse(
      "SCEP operation not supported.",
      {
        status: 400,
      }
    );
  } catch (error) {
    console.error(
      "SCEP GET error:",
      error
    );

    return new NextResponse(
      "SCEP server error.",
      {
        status: 500,
      }
    );
  }
}

/*
|--------------------------------------------------------------------------
| POST
|--------------------------------------------------------------------------
*/

export async function POST(
  request: Request
) {
  try {
    const url =
      new URL(request.url);

    const operation =
      url.searchParams.get(
        "operation"
      );

    console.log(
      "=== SCEP POST ==="
    );

    console.log(
      "Operation:",
      operation
    );

    const body =
      await request.arrayBuffer();

    console.log(
      "Request size:",
      body.byteLength
    );

    if (
      body.byteLength === 0
    ) {
      return new NextResponse(
        "Empty SCEP request.",
        {
          status: 400,
        }
      );
    }

    if (
      operation !==
      "PKIOperation"
    ) {
      return new NextResponse(
        "SCEP operation not supported.",
        {
          status: 400,
        }
      );
    }

    console.log(
      "=== SCEP PKIOperation ==="
    );

    /*
     * ---------------------------------------------------------------
     * CA
     * ---------------------------------------------------------------
     */

    const caCertificate =
      loadCaCertificate();

    const caPrivateKey =
      loadCaPrivateKey();

    console.log(
      "CA loaded."
    );

    console.log(
      "CA subject:",
      caCertificate.subject.attributes
    );

    /*
     * ---------------------------------------------------------------
     * Parse request
     * ---------------------------------------------------------------
     */

    const requestBinary =
      uint8ArrayToBinary(
        new Uint8Array(body)
      );

    const scepRequest =
      parseScepRequest(
        requestBinary
      );

    console.log(
      "Transaction ID:",
      scepRequest.transactionId
    );

    console.log(
      "Message Type:",
      scepRequest.messageType
    );

    console.log(
      "Sender nonce:",
      forge.util.bytesToHex(
        scepRequest.senderNonce
      )
    );

    console.log(
      "Device certificate subject:",
      scepRequest.deviceCertificate
        .subject
        .attributes
    );

    /*
     * ---------------------------------------------------------------
     * Parse inner EnvelopedData
     * ---------------------------------------------------------------
     */

    const envelope =
      forge.pkcs7.messageFromAsn1(
        forge.asn1.fromDer(
          scepRequest.encryptedContent
        )
      );

    if (
      !("recipients" in envelope)
    ) {
      throw new Error(
        "SCEP: il contenuto PKIOperation non è EnvelopedData."
      );
    }

    const recipient =
      envelope.findRecipient(
        caCertificate
      );

    if (!recipient) {
      throw new Error(
        "SCEP: recipient CA non trovato."
      );
    }

    console.log(
      "Decrypting SCEP envelope..."
    );

    envelope.decrypt(
      recipient,
      caPrivateKey
    );

    if (
      envelope.content ===
      undefined
    ) {
      throw new Error(
        "SCEP: contenuto decriptato assente."
      );
    }

    const csrBinary =
      typeof envelope.content ===
      "string"
        ? envelope.content
        : envelope.content.bytes();

    /*
     * ---------------------------------------------------------------
     * CSR
     * ---------------------------------------------------------------
     */

    const csr =
      parseCsr(
        csrBinary
      );

    console.log(
      "CSR subject:",
      csr.subject.attributes
    );

    const csrValid =
      csr.verify();

    console.log(
      "CSR signature valid:",
      csrValid
    );

    if (!csrValid) {
      throw new Error(
        "SCEP: firma CSR non valida."
      );
    }

    /*
     * ---------------------------------------------------------------
     * Challenge
     * ---------------------------------------------------------------
     */

    const challengePassword =
      getChallengePassword(
        csr
      );

    console.log(
      "CSR challenge present:",
      Boolean(
        challengePassword
      )
    );

    if (!challengePassword) {
      throw new Error(
        "SCEP: challengePassword mancante."
      );
    }

    /*
     * ---------------------------------------------------------------
     * Issue certificate
     * ---------------------------------------------------------------
     */

    const issuedCertificate =
      createIssuedCertificate(
        csr,
        caCertificate,
        caPrivateKey
      );

    console.log(
      "Issued certificate serial:",
      issuedCertificate.serialNumber
    );

    console.log(
      "Issued certificate subject:",
      issuedCertificate.subject.attributes
    );

    /*
     * ---------------------------------------------------------------
     * CertRep
     * ---------------------------------------------------------------
     */

    const response =
      createCertRep(
        scepRequest.transactionId,
        scepRequest.senderNonce,
        issuedCertificate,
        caCertificate,
        caPrivateKey,
        scepRequest.deviceCertificate
      );

    console.log(
      "SCEP CertRep SUCCESS size:",
      response.byteLength
    );

    /*
     * ---------------------------------------------------------------
     * Return
     * ---------------------------------------------------------------
     */

    return new NextResponse(
      Buffer.from(response),
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/x-pki-message",

          "Content-Length":
            response.byteLength.toString(),

          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "SCEP PKIOperation error:",
      error
    );

    return new NextResponse(
      "SCEP PKIOperation failed.",
      {
        status: 500,
      }
    );
  }
}