<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('configurations', function (Blueprint $table) {
            $table->unsignedTinyInteger('prank_percentage')->default(20)->after('total_value');
        });
    }

    public function down()
    {
        Schema::table('configurations', function (Blueprint $table) {
            $table->dropColumn('prank_percentage');
        });
    }
};
