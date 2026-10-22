"use client";

import { useEffect, useState } from "react";
import { authorApi, walletApi } from "@/lib/api";
import { DashboardRowsSkeleton } from "@/components/common/PageSkeletons";
import { useAuth } from "@/context/AuthContext";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";

const formatInr = (value) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
}).format(value || 0);

export default function WalletAdminClient() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const canManageWallets = hasPermission(user, PERMISSIONS.MANAGE_WALLETS);
  const canManagePointRates = hasPermission(user, PERMISSIONS.MANAGE_POINT_RATES);
  const [wallets, setWallets] = useState([]);
  const [rates, setRates] = useState({
    authorRate: "",
    editorRate: "",
    authorArticlePoints: "",
    authorBlogPoints: "",
    authorVideoPoints: "",
    editorArticlePoints: "",
    editorBlogPoints: "",
    editorVideoPoints: "",
    editorReviewArticlePoints: "",
    editorReviewBlogPoints: "",
    editorReviewVideoPoints: "",
  });
  const [loading, setLoading] = useState(true);
  const [authorMinimumRemainingInr, setAuthorMinimumRemainingInr] = useState("");
  const [editorMinimumRemainingInr, setEditorMinimumRemainingInr] = useState("");
  const [minimumWithdrawalInr, setMinimumWithdrawalInr] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [savingRates, setSavingRates] = useState(false);
  const [savingWithdrawalRules, setSavingWithdrawalRules] = useState(false);
  const [contentPosts, setContentPosts] = useState([]);
  const [bonus, setBonus] = useState({ userId: "", postKey: "", points: "", reason: "" });
  const [awardingBonus, setAwardingBonus] = useState(false);

  useEffect(() => {
    const requests = [];
    if (canManageWallets) {
      requests.push(walletApi.listForAdmin().then((data) => setWallets(data.wallets)));
    }
    if (canManagePointRates) {
      requests.push(walletApi.getPointRates().then((data) => setRates({
        authorRate: String(data.rates.AUTHOR.rupeesPerPoint),
        editorRate: String(data.rates.EDITOR.rupeesPerPoint),
        authorArticlePoints: String(data.rewardPoints.AUTHOR.ARTICLE),
        authorBlogPoints: String(data.rewardPoints.AUTHOR.BLOG),
        authorVideoPoints: String(data.rewardPoints.AUTHOR.VIDEO),
        editorArticlePoints: String(data.rewardPoints.EDITOR.ARTICLE),
        editorBlogPoints: String(data.rewardPoints.EDITOR.BLOG),
        editorVideoPoints: String(data.rewardPoints.EDITOR.VIDEO),
        editorReviewArticlePoints: String(data.editorReviewRewardPoints?.ARTICLE ?? 1),
        editorReviewBlogPoints: String(data.editorReviewRewardPoints?.BLOG ?? 1),
        editorReviewVideoPoints: String(data.editorReviewRewardPoints?.VIDEO ?? 1),
      })));
    }
    if (isAdmin) {
      requests.push(walletApi.getWithdrawalSettings().then((data) => {
        setAuthorMinimumRemainingInr(String(data.authorMinimumRemainingInr));
        setEditorMinimumRemainingInr(String(data.editorMinimumRemainingInr));
        setMinimumWithdrawalInr(String(data.minimumWithdrawalInr));
      }));
      requests.push(authorApi.listAllHistory({ status: "APPROVED" }).then(setContentPosts));
    }
    Promise.all(requests)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [canManagePointRates, canManageWallets, isAdmin]);

  const toggleAccess = async (wallet) => {
    setError("");
    setUpdatingId(wallet.id);
    try {
      const enabled = !wallet.withdrawalEnabled;
      await walletApi.setWithdrawalAccess(wallet.id, enabled);
      setWallets((current) => current.map((item) => item.id === wallet.id
        ? { ...item, withdrawalEnabled: enabled, accessUpdatedAt: new Date().toISOString() }
        : item
      ));
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const saveRates = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSavingRates(true);
    try {
      const data = await walletApi.updatePointRates(Object.fromEntries(
        Object.entries(rates).map(([key, value]) => [key, Number(value)])
      ));
      setRates({
        authorRate: String(data.rates.AUTHOR.rupeesPerPoint),
        editorRate: String(data.rates.EDITOR.rupeesPerPoint),
        authorArticlePoints: String(data.rewardPoints.AUTHOR.ARTICLE),
        authorBlogPoints: String(data.rewardPoints.AUTHOR.BLOG),
        authorVideoPoints: String(data.rewardPoints.AUTHOR.VIDEO),
        editorArticlePoints: String(data.rewardPoints.EDITOR.ARTICLE),
        editorBlogPoints: String(data.rewardPoints.EDITOR.BLOG),
        editorVideoPoints: String(data.rewardPoints.EDITOR.VIDEO),
        editorReviewArticlePoints: String(data.editorReviewRewardPoints?.ARTICLE ?? 1),
        editorReviewBlogPoints: String(data.editorReviewRewardPoints?.BLOG ?? 1),
        editorReviewVideoPoints: String(data.editorReviewRewardPoints?.VIDEO ?? 1),
      });
      setSuccess(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingRates(false);
    }
  };

  const saveWithdrawalRules = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSavingWithdrawalRules(true);
    try {
      const data = await walletApi.updateWithdrawalSettings(
        Number(minimumWithdrawalInr),
        Number(authorMinimumRemainingInr),
        Number(editorMinimumRemainingInr)
      );
      setAuthorMinimumRemainingInr(String(data.authorMinimumRemainingInr));
      setEditorMinimumRemainingInr(String(data.editorMinimumRemainingInr));
      setMinimumWithdrawalInr(String(data.minimumWithdrawalInr));
      setSuccess(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingWithdrawalRules(false);
    }
  };

  const selectedBonusUser = wallets.find((wallet) => String(wallet.id) === bonus.userId);
  const eligibleBonusPosts = selectedBonusUser ? contentPosts.filter((post) => (
    Number(post.author_id) === selectedBonusUser.id
    || (selectedBonusUser.role === "EDITOR" && Number(post.reviewer_id) === selectedBonusUser.id)
  )) : [];

  const awardBonus = async (event) => {
    event.preventDefault();
    const [contentType, rawContentId] = bonus.postKey.split(":");
    setError("");
    setSuccess("");
    setAwardingBonus(true);
    try {
      const data = await walletApi.awardBonus({
        userId: Number(bonus.userId),
        contentType,
        contentId: Number(rawContentId),
        points: Number(bonus.points),
        reason: bonus.reason.trim(),
      });
      setWallets((current) => current.map((wallet) => wallet.id === data.bonus.userId ? {
        ...wallet,
        availablePoints: data.bonus.balanceAfter,
        availableValueInr: Number((data.bonus.balanceAfter * wallet.rupeesPerPoint).toFixed(2)),
        lifetimeEarnedPoints: wallet.lifetimeEarnedPoints + data.bonus.points,
      } : wallet));
      setBonus({ userId: "", postKey: "", points: "", reason: "" });
      setSuccess(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setAwardingBonus(false);
    }
  };

  return (
    <div className="mx-auto max-w-full px-4 py-10 md:px-16">
      <div className="mb-8">
        <p className="mb-1 font-label-md text-xs uppercase tracking-[0.16em] text-on-surface-variant">Administration</p>
        <h1 className="font-display-lg text-3xl text-primary">Wallet &amp; Points</h1>
        <p className="mt-2 max-w-3xl font-body-md text-sm text-on-surface-variant">
          Control contributor withdrawals and set how much one point is worth for Authors and Editors.
        </p>
      </div>

      {error && <p className="mb-5 rounded-lg border border-error/25 bg-error/5 p-4 font-body-md text-sm text-error" role="alert">{error}</p>}
      {success && <p className="mb-5 rounded-lg border border-green-600/25 bg-green-50 p-4 font-body-md text-sm text-green-700" role="status">{success}</p>}

      {loading ? (
        <DashboardRowsSkeleton />
      ) : (
        <div className="space-y-10">
          {canManagePointRates && (
            <form onSubmit={saveRates} className="rounded-xl border border-outline-variant/20 bg-surface-container p-5">
              <div className="mb-5">
                <h2 className="font-display-lg text-2xl text-primary">Point settings</h2>
                <p className="mt-1 font-body-md text-xs text-on-surface-variant">Set rewards for newly approved content and the INR value of one point. Existing wallet transactions are not rewritten.</p>
              </div>
              <div className="grid gap-5 xl:grid-cols-2">
                {[
                  { role: "Author", prefix: "author", rateKey: "authorRate" },
                  { role: "Editor", prefix: "editor", rateKey: "editorRate" },
                ].map(({ role, prefix, rateKey }) => (
                  <section key={role} className="rounded-xl border border-outline-variant/25 bg-surface p-5">
                    <h3 className="font-display-lg text-xl text-primary">{role} points</h3>
                    <p className="mb-4 mt-1 font-body-md text-xs text-on-surface-variant">Rewards when content created by an {role.toLowerCase()} is approved.</p>
                    <div className="grid gap-4 sm:grid-cols-3">
                      {[["Article", "Article"], ["Blog", "Blog"], ["Video", "Video"]].map(([suffix, label]) => {
                        const key = `${prefix}${suffix}Points`;
                        return (
                          <label key={key} className="block">
                            <span className="mb-1.5 block font-label-md text-xs font-semibold text-on-surface">Approved {label} (points)</span>
                            <input
                              type="number"
                              min="1"
                              max="1000000"
                              step="1"
                              required
                              value={rates[key]}
                              onChange={(event) => setRates((current) => ({ ...current, [key]: event.target.value }))}
                              className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 font-body-md text-on-surface outline-none focus:border-primary"
                            />
                          </label>
                        );
                      })}
                    </div>
                    <label className="mt-4 block">
                      <span className="mb-1.5 block font-label-md text-xs font-semibold text-on-surface">1 point equals (INR)</span>
                      <input
                        type="number"
                        min="0.0001"
                        max="100000"
                        step="0.0001"
                        required
                        value={rates[rateKey]}
                        onChange={(event) => setRates((current) => ({ ...current, [rateKey]: event.target.value }))}
                        className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 font-body-md text-on-surface outline-none focus:border-primary"
                      />
                    </label>
                  </section>
                ))}
              </div>
              <section className="mt-5 rounded-xl border border-outline-variant/25 bg-surface p-5">
                <h3 className="font-display-lg text-xl text-primary">Editor approval rewards</h3>
                <p className="mb-4 mt-1 font-body-md text-xs text-on-surface-variant">
                  Points earned by an Editor for approving an Author&apos;s post. Each post can reward that Editor only once.
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  {[["Article", "Article"], ["Blog", "Blog"], ["Video", "Video"]].map(([suffix, label]) => {
                    const key = `editorReview${suffix}Points`;
                    return (
                      <label key={key} className="block">
                        <span className="mb-1.5 block font-label-md text-xs font-semibold text-on-surface">Approve {label} (points)</span>
                        <input
                          type="number"
                          min="1"
                          max="1000000"
                          step="1"
                          required
                          value={rates[key]}
                          onChange={(event) => setRates((current) => ({ ...current, [key]: event.target.value }))}
                          className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 font-body-md text-on-surface outline-none focus:border-primary"
                        />
                      </label>
                    );
                  })}
                </div>
              </section>
              <button type="submit" disabled={savingRates} className="mt-5 min-h-11 rounded-lg bg-primary px-5 font-label-md text-sm font-semibold text-on-primary disabled:opacity-60">
                {savingRates ? "Saving..." : "Save point settings"}
              </button>
            </form>
          )}

          {isAdmin && (
            <form onSubmit={awardBonus} className="rounded-xl border border-amber-500/30 bg-amber-50/40 p-5">
              <div className="mb-5">
                <p className="mb-1 font-label-md text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700">Admin bonus</p>
                <h2 className="font-display-lg text-2xl text-primary">Award bonus points</h2>
                <p className="mt-1 font-body-md text-xs text-on-surface-variant">Credit an Author or Editor for approved content. The content title and your reason will appear in their Wallet points history.</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block font-label-md text-xs font-semibold text-on-surface">Recipient</span>
                  <select
                    required
                    value={bonus.userId}
                    onChange={(event) => setBonus((current) => ({ ...current, userId: event.target.value, postKey: "" }))}
                    className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 font-body-md text-on-surface outline-none focus:border-primary"
                  >
                    <option value="">Select Author or Editor</option>
                    {wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} ({wallet.role})</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block font-label-md text-xs font-semibold text-on-surface">Related approved content</span>
                  <select
                    required
                    disabled={!selectedBonusUser}
                    value={bonus.postKey}
                    onChange={(event) => setBonus((current) => ({ ...current, postKey: event.target.value }))}
                    className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 font-body-md text-on-surface outline-none focus:border-primary disabled:opacity-60"
                  >
                    <option value="">{selectedBonusUser ? "Select article, blog, or video" : "Select a recipient first"}</option>
                    {eligibleBonusPosts.map((post) => {
                      const relationship = Number(post.author_id) === selectedBonusUser.id ? "Created" : "Approved";
                      return <option key={`${post.type}:${post.id}`} value={`${post.type}:${post.id}`}>{relationship}: {post.title} ({post.type})</option>;
                    })}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block font-label-md text-xs font-semibold text-on-surface">Bonus points</span>
                  <input
                    type="number"
                    min="1"
                    max="1000000"
                    step="1"
                    required
                    value={bonus.points}
                    onChange={(event) => setBonus((current) => ({ ...current, points: event.target.value }))}
                    className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 font-body-md text-on-surface outline-none focus:border-primary"
                  />
                </label>
                <label className="block lg:row-span-2">
                  <span className="mb-1.5 block font-label-md text-xs font-semibold text-on-surface">Reason for bonus</span>
                  <textarea
                    required
                    minLength={5}
                    maxLength={500}
                    rows={4}
                    value={bonus.reason}
                    onChange={(event) => setBonus((current) => ({ ...current, reason: event.target.value }))}
                    placeholder="Explain why this content earned a bonus..."
                    className="w-full resize-y rounded-lg border border-outline-variant/40 bg-surface px-3 py-2.5 font-body-md text-on-surface outline-none focus:border-primary"
                  />
                  <span className="mt-1 block text-right font-label-md text-[10px] text-on-surface-variant">{bonus.reason.length}/500</span>
                </label>
              </div>
              <button type="submit" disabled={awardingBonus} className="mt-5 min-h-11 rounded-lg bg-amber-600 px-5 font-label-md text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-wait disabled:opacity-60">
                <i className="fa-solid fa-gift mr-2" aria-hidden="true" />{awardingBonus ? "Awarding..." : "Award bonus points"}
              </button>
            </form>
          )}

          {isAdmin && (
            <form onSubmit={saveWithdrawalRules} className="rounded-xl border border-outline-variant/20 bg-surface-container p-5">
              <div className="mb-4">
                <p className="mb-1 font-label-md text-[10px] font-bold uppercase tracking-[0.16em] text-error">Admin only</p>
                <h2 className="font-display-lg text-2xl text-primary">Withdrawal rules</h2>
                <p className="mt-1 font-body-md text-xs text-on-surface-variant">Withdrawals are available on any date, once per India calendar month. Set the qualifying balance and the amount each role must leave behind.</p>
              </div>
              <div className="grid max-w-4xl gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="mb-1.5 block font-label-md text-xs font-semibold text-on-surface">Minimum balance to qualify (INR)</span>
                  <input
                    type="number"
                    min="0.01"
                    max="100000000"
                    step="0.01"
                    required
                    value={minimumWithdrawalInr}
                    onChange={(event) => setMinimumWithdrawalInr(event.target.value)}
                    className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 font-body-md text-on-surface outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block font-label-md text-xs font-semibold text-on-surface">Author minimum remaining balance (INR)</span>
                  <input
                    type="number"
                    min="0"
                    max="100000000"
                    step="0.01"
                    required
                    value={authorMinimumRemainingInr}
                    onChange={(event) => setAuthorMinimumRemainingInr(event.target.value)}
                    className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 font-body-md text-on-surface outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block font-label-md text-xs font-semibold text-on-surface">Editor minimum remaining balance (INR)</span>
                  <input
                    type="number"
                    min="0"
                    max="100000000"
                    step="0.01"
                    required
                    value={editorMinimumRemainingInr}
                    onChange={(event) => setEditorMinimumRemainingInr(event.target.value)}
                    className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 font-body-md text-on-surface outline-none focus:border-primary"
                  />
                </label>
              </div>
              <button type="submit" disabled={savingWithdrawalRules} className="mt-4 min-h-11 rounded-lg bg-primary px-5 font-label-md text-sm font-semibold text-on-primary disabled:opacity-60">
                {savingWithdrawalRules ? "Saving..." : "Save withdrawal rules"}
              </button>
            </form>
          )}

          {canManageWallets && (
            <section>
              <div className="mb-5">
                <h2 className="font-display-lg text-2xl text-primary">Withdrawal access</h2>
                <p className="mt-1 font-body-md text-xs text-on-surface-variant">Enabled users can request on any date, but only once per month and only from the balance above their required reserve.</p>
              </div>
              {wallets.length === 0 ? (
                <p className="font-body-md text-sm text-on-surface-variant">No Authors or Editors found.</p>
              ) : <div className="space-y-3">
          {wallets.map((wallet) => (
            <div key={wallet.id} className="flex flex-col gap-4 rounded-xl border border-outline-variant/20 bg-surface-container p-5 lg:flex-row lg:items-center">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <i className="fa-solid fa-user" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-label-md text-sm font-semibold text-on-surface">{wallet.name}</h2>
                  <span className="rounded bg-surface-container-high px-2 py-0.5 font-label-md text-[10px] font-bold uppercase text-on-surface-variant">{wallet.role}</span>
                </div>
                <p className="mt-1 truncate font-body-md text-xs text-on-surface-variant">{wallet.email}</p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center lg:w-80">
                <div><p className="font-body-md font-semibold tabular-nums">{wallet.availablePoints.toLocaleString("en-IN")}</p><p className="text-[10px] text-on-surface-variant">Available</p></div>
                <div><p className="font-body-md font-semibold tabular-nums">{wallet.pendingWithdrawalPoints.toLocaleString("en-IN")}</p><p className="text-[10px] text-on-surface-variant">Pending</p></div>
                <div><p className="font-body-md font-semibold tabular-nums">{wallet.lifetimeEarnedPoints.toLocaleString("en-IN")}</p><p className="text-[10px] text-on-surface-variant">Earned</p></div>
              </div>
              <div className="min-w-28 text-center lg:text-right">
                <p className="font-label-md text-xs font-semibold text-on-surface">1 point = {formatInr(wallet.rupeesPerPoint)}</p>
                <p className="mt-1 font-body-md text-[10px] text-on-surface-variant">Balance {formatInr(wallet.availableValueInr)}</p>
              </div>
              <button
                type="button"
                disabled={updatingId === wallet.id}
                onClick={() => toggleAccess(wallet)}
                aria-pressed={wallet.withdrawalEnabled}
                className={`min-h-11 rounded-lg px-5 font-label-md text-sm font-semibold disabled:opacity-60 ${wallet.withdrawalEnabled
                  ? "border border-error/30 bg-error/5 text-error hover:bg-error/10"
                  : "bg-primary text-on-primary hover:bg-primary-container"
                }`}
              >
                {updatingId === wallet.id ? "Updating..." : wallet.withdrawalEnabled ? "Block withdrawal" : "Enable withdrawal"}
              </button>
            </div>
          ))}
                </div>}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
