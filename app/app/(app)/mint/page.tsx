"use client";

import { motion } from "framer-motion";

import { GradientBg } from "@/components/shared/GradientBg";
import { GlowingBadge } from "@/components/shared/GlowingBadge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { titleVariants, subtitleVariants } from "@/lib/animations";

import { MintForm } from "./_components/MintForm";

export default function MintPage() {
  return (
    <GradientBg variant="subtle" className="min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          animate="visible"
          className="mb-10 flex flex-col gap-4"
        >
          <motion.div variants={subtitleVariants}>
            <GlowingBadge variant="blue">Mint iNFT</GlowingBadge>
          </motion.div>
          <motion.h1
            variants={titleVariants}
            className="text-balance text-4xl font-semibold tracking-tight text-white md:text-5xl"
          >
            Register a Data, Model, or Skill iNFT
          </motion.h1>
          <motion.p
            variants={subtitleVariants}
            className="max-w-2xl text-balance text-base text-white/60"
          >
            Encrypt your artifact with libsodium, anchor the storage root in the
            LineageRegistry on 0G Galileo testnet, and declare provenance and
            royalty policy in one transaction.
          </motion.p>
        </motion.div>

        <Tabs defaultValue="data" className="w-full">
          <TabsList className="mb-6 h-10 bg-white/[0.04] p-1">
            <TabsTrigger value="data" className="px-5">
              Data
            </TabsTrigger>
            <TabsTrigger value="model" className="px-5">
              Model
            </TabsTrigger>
            <TabsTrigger value="skill" className="px-5">
              Skill
            </TabsTrigger>
          </TabsList>

          <TabsContent value="data">
            <MintForm
              kind="data"
              title="Data"
              description="A training dataset or single record. Royalty defaults to 2%, owner split 80/20."
            />
          </TabsContent>
          <TabsContent value="model">
            <MintForm
              kind="model"
              title="Model"
              description="A model checkpoint or weights archive. Declare which Data and Model parents this was trained on."
            />
          </TabsContent>
          <TabsContent value="skill">
            <MintForm
              kind="skill"
              title="Skill"
              description="A composable adapter, prompt, or tool. Declare which Models and Skills it depends on."
            />
          </TabsContent>
        </Tabs>
      </div>
    </GradientBg>
  );
}
