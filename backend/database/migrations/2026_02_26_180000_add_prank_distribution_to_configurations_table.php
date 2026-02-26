<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('configurations', function (Blueprint $table) {
            if (!Schema::hasColumn('configurations', 'prank_distribution')) {
                $table->json('prank_distribution')->nullable()->after('prank_percentage');
            }
        });
    }

    public function down(): void
    {
        Schema::table('configurations', function (Blueprint $table) {
            if (Schema::hasColumn('configurations', 'prank_distribution')) {
                $table->dropColumn('prank_distribution');
            }
        });
    }
};
