import Stripe from "stripe";
import { serverEnv } from "./env";

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripe) {
    stripe = new Stripe(serverEnv().STRIPE_SECRET_KEY);
  }
  return stripe;
}
