"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PostForm from "@/components/author/PostForm";
import { authorApi } from "@/lib/api";
import { resolveBackTarget } from "@/lib/postNav";
import { FormBodySkeleton } from "@/components/common/PageSkeletons";

export default function EditPostClient({ type, id }) {
  const searchParams = useSearchParams();
  const redirectTo = resolveBackTarget(searchParams.get("from")).href;
  const [post, setPost] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authorApi
      .getPost(type, id)
      .then((data) => setPost(data.post))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [type, id]);

  if (loading) return <FormBodySkeleton />;

  if (error || !post) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <i className="fa-solid fa-triangle-exclamation text-4xl text-error mb-4" />
        <h1 className="font-display-lg text-2xl text-primary mb-2">Post Not Found</h1>
        <p className="font-body-md text-on-surface-variant mb-6">{error || "This post doesn't exist or you don't have access to it."}</p>
        <Link href="/author/dashboard" className="inline-block bg-primary text-on-primary px-6 py-2 font-label-md uppercase tracking-widest hover:bg-primary-container transition-colors">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const label = post.type.charAt(0) + post.type.slice(1).toLowerCase();

  return (
    <div className="max-w-full mx-auto px-4 md:px-16 py-10">
      <h1 className="font-display-lg text-3xl text-primary mb-2">Edit {label}</h1>
      <p className="font-body-md text-on-surface-variant mb-8">
        Editing resets this post to Draft status until it&apos;s resubmitted.
      </p>
      
      <PostForm type={post.type} post={post} redirectTo={redirectTo} />
    </div>
  );
}
