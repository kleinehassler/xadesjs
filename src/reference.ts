/// <reference path="./crypto_config.ts" />

namespace xadesjs {

    // http://www.w3.org/TR/2002/REC-xmldsig-core-20020212/Overview.html#sec-Reference
    export class Reference extends XmlObject {

        private chain: Transform[];
        private digestMethod: string;
        private digestValue: ArrayBuffer;
        private id: string;
        private uri: string;
        private type: string;
        private element: Element;

        public constructor(p?: string) {
            super();
            // 
            this.chain = [];
            this.digestMethod = XmlSignature.NamespaceURI + "sha1";
            if (typeof p === "string") {
                this.uri = p;
            }
        }

        // default to SHA1
        get DigestMethod(): string {
            return this.digestMethod;
        }
        set DigestMethod(value: string) {
            this.element = null;
            this.digestMethod = value;
        }


        get DigestValue(): ArrayBuffer {
            return this.digestValue;
        }
        set DigestValue(value: ArrayBuffer) {
            this.element = null;
            this.digestValue = value;
        }

        get Id(): string {
            return this.id;
        }
        set Id(value: string) {
            this.element = null;
            this.id = value;
        }

        get TransformChain(): Transform[] {
            return this.chain;
        }
        set TransformChain(value:  Transform[]) {
            this.chain = value;
        }

        get Type(): string {
            return this.type;
        }
        set Type(value: string) {
            this.element = null;
            this.type = value;
        }

        get Uri(): string {
            return this.uri;
        }
        set Uri(value: string) {
            this.element = null;
            this.uri = value;
        }

        AddTransform(transform: Transform): void {
            this.chain.push(transform);
        }

        getXml(): Element {
            if (this.element != null)
                return this.element;

            if (this.digestMethod == null)
                throw new XmlError(XE.CRYPTOGRAPHIC, "DigestMethod");
            if (this.digestValue == null)
                throw new XmlError(XE.PARAM_REQUIRED, "DigestValue");

            let doc = document.implementation.createDocument("", "", null);
            let xel = doc.createElementNS(XmlSignature.NamespaceURI, XmlSignature.ElementNames.Reference);
            if (this.id != null)
                xel.setAttribute(XmlSignature.AttributeNames.Id, this.id);
            if (this.uri != null)
                xel.setAttribute(XmlSignature.AttributeNames.URI, this.uri);
            if (this.type != null)
                xel.setAttribute(XmlSignature.AttributeNames.Type, this.type);

            if (this.chain.length > 0) {
                let ts = doc.createElementNS(XmlSignature.NamespaceURI, XmlSignature.ElementNames.Transforms);
                for (let i in this.chain) {
                    let t = this.chain[i];
                    let xn = t.getXml();
                    let newNode = doc.importNode(xn, true);
                    ts.appendChild(newNode);
                }
                xel.appendChild(ts);
            }

            let dm = doc.createElementNS(XmlSignature.NamespaceURI, XmlSignature.ElementNames.DigestMethod);
            dm.setAttribute(XmlSignature.AttributeNames.Algorithm, this.digestMethod);
            xel.appendChild(dm);

            let dv = doc.createElementNS(XmlSignature.NamespaceURI, XmlSignature.ElementNames.DigestValue);
            dv.textContent = Convert.ToBase64String(Convert.FromBufferString(this.digestValue));
            xel.appendChild(dv);

            return xel;
        }

        // note: we do NOT return null -on purpose- if attribute isn't found
        private GetAttribute(xel: Element, attribute: string): string {
            return xel.hasAttribute(attribute) ? xel.getAttribute(attribute) : null;
        }

        loadXml(value: Element) {
            if (value == null)
                throw new XmlError(XE.PARAM_REQUIRED, "value");

            if ((value.localName !== XmlSignature.ElementNames.Reference) || (value.namespaceURI !== XmlSignature.NamespaceURI))
                throw new XmlError(XE.CRYPTOGRAPHIC, "value");

            this.id = this.GetAttribute(value, XmlSignature.AttributeNames.Id);
            this.uri = this.GetAttribute(value, XmlSignature.AttributeNames.URI);
            this.type = this.GetAttribute(value, XmlSignature.AttributeNames.Type);
            // Note: order is important for validations
            let xnl = value.getElementsByTagNameNS(XmlSignature.NamespaceURI, XmlSignature.ElementNames.Transform);
            if ((xnl != null) && (xnl.length > 0)) {
                let t: Transform = null;
                for (let i = 0; i < xnl.length; i++) {
                    let xn = xnl[i];
                    let a = this.GetAttribute(<Element>xn, XmlSignature.AttributeNames.Algorithm);
                    /*	This code is useful for debugging in VS.NET because using CryptoConfig
                        (from MS mscorlib) would throw InvalidCastException because it's 
                        Transform would come from MS System.Security.dll not Mono's.
                                        switch (a) {
                                            case "http://www.w3.org/2000/09/xmldsig#base64":
                                                t = new XmlDsigBase64Transform ();
                                                break;
                                            case "http://www.w3.org/TR/2001/REC-xml-c14n-20010315":
                                                t = new XmlDsigC14NTransform ();
                                                break;
                                            case "http://www.w3.org/TR/2001/REC-xml-c14n-20010315#WithComments":
                                                t = new XmlDsigC14NWithCommentsTransform ();
                                                break;
                                            case "http://www.w3.org/2000/09/xmldsig#enveloped-signature":
                                                t = new XmlDsigEnvelopedSignatureTransform ();
                                                break;
                                            case "http://www.w3.org/TR/1999/REC-xpath-19991116":
                                                t = new XmlDsigXPathTransform ();
                                                break;
                                            case "http://www.w3.org/TR/1999/REC-xslt-19991116":
                                                t = new XmlDsigXsltTransform ();
                                                break;
                                            case "http://www.w3.org/2002/07/decrypt#XML":
                                                t = new XmlDecryptionTransform ();
                                                break;
                                            default:
                                                throw new NotSupportedException ();
                                        }
                    */
                    t = <Transform>CryptoConfig.CreateFromName(a);
                    if (t == null)
                        throw new XmlError(XE.CRYPTOGRAPHIC_UNKNOWN_TRANSFORM, a);

                    if (xn.childNodes.length > 0) {
                        t.LoadInnerXml(xn.childNodes);
                    }
                    this.AddTransform(t);
                }
            }
            // get DigestMethod
            this.DigestMethod = XmlSignature.GetAttributeFromElement(value, XmlSignature.AttributeNames.Algorithm, XmlSignature.ElementNames.DigestMethod);
            // get DigestValue
            let dig = XmlSignature.GetChildElement(value, XmlSignature.ElementNames.DigestValue, XmlSignature.NamespaceURI);
            if (dig != null)
                this.DigestValue = Convert.ToBufferString(Convert.FromBase64String(dig.textContent));
            this.element = value;
        }
    }

}