package de.wellenvogel.avnav.util;

import java.math.BigInteger;
import java.security.InvalidKeyException;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.NoSuchProviderException;
import java.security.Principal;
import java.security.PublicKey;
import java.security.SignatureException;
import java.security.cert.CertificateEncodingException;
import java.security.cert.CertificateException;
import java.security.cert.CertificateExpiredException;
import java.security.cert.CertificateNotYetValidException;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import javax.net.ssl.SSLSocket;
import javax.net.ssl.TrustManager;
import javax.net.ssl.TrustManagerFactory;
import javax.net.ssl.X509TrustManager;

/*
# Copyright (c) 2022,2026 Andreas Vogel andreas@wellenvogel.net

#  Permission is hereby granted, free of charge, to any person obtaining a
#  copy of this software and associated documentation files (the "Software"),
#  to deal in the Software without restriction, including without limitation
#  the rights to use, copy, modify, merge, publish, distribute, sublicense,
#  and/or sell copies of the Software, and to permit persons to whom the
#  Software is furnished to do so, subject to the following conditions:
#
#  The above copyright notice and this permission notice shall be included
#  in all copies or substantial portions of the Software.
#
#  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
#  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
*/

/**
 * Trust manager that ignores certificate expiration. This is useful for allowing toe access servers if the system time is incorrect.
 * based on https://gist.github.com/divergentdave/9a68d820e3610513bd4fcdc4ae5f91a1
 */
public class IgnoreExpiredTrustmanager implements X509TrustManager {
    private final X509TrustManager innerTrustManager;

    public IgnoreExpiredTrustmanager(X509TrustManager innerTrustManager) {
        this.innerTrustManager = innerTrustManager;
    }

    @Override
    public void checkClientTrusted(X509Certificate[] chain, String authType) throws CertificateException {
        this.innerTrustManager.checkClientTrusted(chain, authType);
    }

    @Override
    public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {
        X509Certificate[] newChain = new X509Certificate[chain.length];
        for (int i = 0; i < chain.length; i++) {
            newChain[i] = new EternalCertificate(chain[i]);
        }
        chain = newChain;
        this.innerTrustManager.checkServerTrusted(chain, authType);
    }


    @Override
    public X509Certificate[] getAcceptedIssuers() {
        return this.innerTrustManager.getAcceptedIssuers();
    }

    private static class EternalCertificate extends X509Certificate {
        private final X509Certificate originalCertificate;

        public EternalCertificate(X509Certificate originalCertificate) {
            this.originalCertificate = originalCertificate;
        }

        @Override
        public void checkValidity() throws CertificateExpiredException, CertificateNotYetValidException {
            AvnLog.d("ignoring certificate validity check for "+originalCertificate.getSubjectDN().getName());
            // Ignore notBefore/notAfter
        }


        @Override
        public void checkValidity(Date date) throws CertificateExpiredException, CertificateNotYetValidException {
            AvnLog.d("ignoring certificate validity check for "+originalCertificate.getSubjectDN().getName());
            // Ignore notBefore/notAfter
        }

        @Override
        public int getVersion() {
            return originalCertificate.getVersion();
        }

        @Override
        public BigInteger getSerialNumber() {
            return originalCertificate.getSerialNumber();
        }

        @Override
        public Principal getIssuerDN() {
            return originalCertificate.getIssuerDN();
        }

        @Override
        public Principal getSubjectDN() {
            return originalCertificate.getSubjectDN();
        }

        @Override
        public Date getNotBefore() {
            return originalCertificate.getNotBefore();
        }

        @Override
        public Date getNotAfter() {
            return originalCertificate.getNotAfter();
        }

        @Override
        public byte[] getTBSCertificate() throws CertificateEncodingException {
            return originalCertificate.getTBSCertificate();
        }

        @Override
        public byte[] getSignature() {
            return originalCertificate.getSignature();
        }

        @Override
        public String getSigAlgName() {
            return originalCertificate.getSigAlgName();
        }

        @Override
        public String getSigAlgOID() {
            return originalCertificate.getSigAlgOID();
        }

        @Override
        public byte[] getSigAlgParams() {
            return originalCertificate.getSigAlgParams();
        }

        @Override
        public boolean[] getIssuerUniqueID() {
            return originalCertificate.getIssuerUniqueID();
        }

        @Override
        public boolean[] getSubjectUniqueID() {
            return originalCertificate.getSubjectUniqueID();
        }

        @Override
        public boolean[] getKeyUsage() {
            return originalCertificate.getKeyUsage();
        }

        @Override
        public int getBasicConstraints() {
            return originalCertificate.getBasicConstraints();
        }

        @Override
        public byte[] getEncoded() throws CertificateEncodingException {
            return originalCertificate.getEncoded();
        }

        @Override
        public void verify(PublicKey key) throws CertificateException, NoSuchAlgorithmException, InvalidKeyException, NoSuchProviderException, SignatureException {
            originalCertificate.verify(key);
        }

        @Override
        public void verify(PublicKey key, String sigProvider) throws CertificateException, NoSuchAlgorithmException, InvalidKeyException, NoSuchProviderException, SignatureException {
            originalCertificate.verify(key, sigProvider);
        }

        @Override
        public String toString() {
            return originalCertificate.toString();
        }


        @Override
        public PublicKey getPublicKey() {
            return originalCertificate.getPublicKey();
        }

        @Override
        public Set<String> getCriticalExtensionOIDs() {
            return originalCertificate.getCriticalExtensionOIDs();
        }

        @Override
        public byte[] getExtensionValue(String oid) {
            return originalCertificate.getExtensionValue(oid);
        }

        @Override
        public Set<String> getNonCriticalExtensionOIDs() {
            return originalCertificate.getNonCriticalExtensionOIDs();
        }

        @Override
        public boolean hasUnsupportedCriticalExtension() {
            return originalCertificate.hasUnsupportedCriticalExtension();
        }
    }

    public static TrustManager [] getDefaultTrustManagers() throws Exception {
        TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        tmf.init((KeyStore) null);
        TrustManager[] trustManagers = tmf.getTrustManagers();
        for (int i = 0; i < trustManagers.length; i++) {
            if (trustManagers[i] instanceof X509TrustManager) {
                trustManagers[i] = new IgnoreExpiredTrustmanager((X509TrustManager) trustManagers[i]);
            }
        }
        return trustManagers;
    }

    /**
     * ensure to enable TLSv1.2 on older APSi versions
     * if we create the SSL context with 'TLS'
     * @param socket
     * @return
     */
    public static SSLSocket ensureTls12Enabled(SSLSocket socket) {
        List<String> supported = Arrays.asList(socket.getSupportedProtocols());
        List<String> enabled = new ArrayList<>(Arrays.asList(socket.getEnabledProtocols()));

        if (supported.contains("TLSv1.2") && !enabled.contains("TLSv1.2")) {
            enabled.add("TLSv1.2");
            socket.setEnabledProtocols(enabled.toArray(new String[0]));
        }
        return socket;
    }
    public static String getSSlContextProtocol() {
        return "TLS";
    }
}

