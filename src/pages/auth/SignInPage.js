// SignInPage.js
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import SignInForm from "../../components/auth/SignInForm/SignInForm";
import { checkSeller, checkOnboardStatus, getUserProfile } from "../../services/sellerService";
function SignInPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [contact,         setContact]         = useState("");
  const [password,        setPassword]        = useState("");
  const [showPassword,    setShowPassword]    = useState(false);
  const [verifiedContact, setVerifiedContact] = useState(null);
  const [error,           setError]           = useState("");
  const [loading,         setLoading]         = useState(false);

  useEffect(() => {
    const prefill = location.state?.prefillContact;
    if (prefill) setContact(prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Handle Continue (email/phone check) ─────────────────────────────────
  const handleContinue = async () => {
    const trimmed = contact.trim();

    if (!trimmed) {
      setError("Please enter your email or mobile number.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await checkSeller(trimmed);

      if (result.userExists) {
        if (result.contactType === "email") {
          // ✅ Email & registered → show password field inline
          setVerifiedContact({
            contact:     trimmed,
            contactType: result.contactType,
            email:       result.email,
            phone:       result.phone,
          });
          setShowPassword(true);
        } else {
          // ✅ Phone & registered → navigate to OTP page
          navigate("/otp", {
            state: {
              contact:     trimmed,
              contactType: result.contactType,
              email:       result.email,
              phone:       result.phone,
            },
          });
        }
      } else {
        // ❌ Not registered → show inline error
        const errorMsg =
          result.contactType === "email"
            ? "This email is not registered. Please sign up first."
            : "This phone number is not registered. Please sign up first.";
        setError(errorMsg);
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Handle Sign In (password submit) ────────────────────────────────────
  const handleSignIn = async () => {
    if (!password.trim()) {
      setError("Please enter your password.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Resolve the real email — prefer verified email, fall back to contact
      const emailForStatus = (
        verifiedContact?.email   ||
        verifiedContact?.contact ||
        contact.trim()
      ).toLowerCase().trim();

      // ── Save to BOTH storages before navigating ──────────────────────────
      // sessionStorage → available within the tab session
      // localStorage   → survives page refresh (MyListings fallback)
      sessionStorage.setItem("pendingEmail", emailForStatus);
      localStorage.setItem("userEmail",      emailForStatus);

      // Pre-fetch profile to resolve and store sellerId
      try {
        const profileRes = await getUserProfile(emailForStatus);
        const rawMsg = profileRes?.message;
        const p = Array.isArray(rawMsg) ? (rawMsg[0] || {}) : (profileRes?.data || profileRes || {});
        const foundSellerId = p.sellerId || p.seller_id || p.uid || p.id;
        if (foundSellerId) {
          const sid = String(foundSellerId).trim();
          localStorage.setItem("sellerId", sid);
          sessionStorage.setItem("sellerId", sid);
          localStorage.setItem("__haatza_sellerId", sid);
          sessionStorage.setItem("__haatza_sellerId", sid);
        }
      } catch (err) {
        console.warn("[SignInPage] Pre-fetching profile for sellerId failed:", err);
      }
      
      const isOnboarded = await checkOnboardStatus(emailForStatus);

      if (isOnboarded) {
        // ✅ Fully onboarded → go straight to My Listings
        navigate("/dashboard/my-listings", {
          state: { email: emailForStatus },   // always pass email in state
        });
      } else {
        // ⚠️ Onboarding incomplete → go to onboarding
        navigate("/onboarding", {
          state: {
            ...verifiedContact,
            email: emailForStatus,
          },
        });
      }
    } catch (err) {
      // Onboard check failed — email is already saved, still go to dashboard
      const emailFallback = (
        verifiedContact?.email   ||
        verifiedContact?.contact ||
        contact.trim()
      ).toLowerCase().trim();

      sessionStorage.setItem("pendingEmail", emailFallback);
      localStorage.setItem("userEmail",      emailFallback);

      console.error("Onboard status check failed:", err);
      navigate("/dashboard/my-listings", {
        state: { email: emailFallback },
      });
    } finally {
      setLoading(false);
    }
  };

  // ─── Reset password step if contact field changes ─────────────────────────
  const handleContactChange = (value) => {
    setContact(value);
    if (showPassword) {
      setShowPassword(false);
      setPassword("");
      setVerifiedContact(null);
    }
    if (error) setError("");
  };

  const handlePasswordChange = (value) => {
    setPassword(value);
    if (error) setError("");
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <SignInForm
      contact={contact}
      onContactChange={handleContactChange}
      password={password}
      onPasswordChange={handlePasswordChange}
      showPassword={showPassword}
      loading={loading}
      error={error}
      onContinue={handleContinue}
      onSignIn={handleSignIn}
      onRegister={() => navigate("/signup")}
    />
  );
}

export default SignInPage;