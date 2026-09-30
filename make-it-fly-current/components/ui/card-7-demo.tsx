import { InteractiveProductCard } from "@/components/ui/card-7";

/** Isolated example supplied with the component; not part of the store catalog. */
export default function InteractiveProductCardDemo() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <InteractiveProductCard
        title="Nike M2K Tekno"
        description="Elevate Your Every Step"
        price="$149"
        imageUrl="https://cdn.21st.dev/assets/mirror/d9/d9c9632fe87053e4745e502df4d3b48480a53b2800e092f745d9e28a98f1995b.jpg"
        logoUrl="https://cdn.21st.dev/assets/mirror/54/54bb728904e14583753fcde786a9901b53ca9c8401ac207fb516841f9863c55a.svg"
      />
    </div>
  );
}
