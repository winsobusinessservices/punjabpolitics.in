import Link from "next/link";
import ImagePlaceholder from "@/components/common/ImagePlaceholder";

export default function CMCard({ name, subtitle, href, photo, photoFallback }) {
  const Wrapper = href ? Link : "div";
  const wrapperProps = href ? { href } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className="group flex flex-col bg-surface-container-low rounded-lg overflow-hidden border border-outline-variant/20 hover:shadow-md transition-all duration-300 p-2"
    >
      <ImagePlaceholder
        icon="fa-solid fa-user-tie"
        image={photo}
        fallbackImage={photoFallback}
        alt={name}
        gradient="primary"
        className="aspect-[2/2] rounded-md object-center"
        iconClassName="text-3xl"
      />
      <div className="p-3 flex flex-col gap-1 items-center text-center">
        <h3 className="font-headline-md text-base text-on-surface group-hover:text-primary transition-colors">
          {name}
        </h3>
        <p className="font-body-md text-xs text-on-surface-variant">{subtitle}</p>
      </div>
    </Wrapper>
  );
}
