<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('codes', function (Blueprint $table) {
            $table->id();
            $table->string('code', 12)->unique();
            $table->unsignedBigInteger('configuration_id')->nullable();
            $table->decimal('value', 8, 2);
            $table->enum('status', ['pending', 'used'])->default('pending');
            $table->timestamp('used_at')->nullable();
            $table->timestamps();

            $table->foreign('configuration_id')
                ->references('id')
                ->on('configurations')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('codes');
    }
};
